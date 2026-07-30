# Production Deployment Runbook — NexaTech M18

Step-by-step guide for **operators**. Unattended agents MUST stop at dry-run / lint / template steps marked **BLOCKED_EXTERNAL**.

## Infrastructure topology

| Role                     | IP / host         | Operator responsibilities                                 |
| ------------------------ | ----------------- | --------------------------------------------------------- |
| PostgreSQL               | `192.168.4.208`   | 14 DBs + app users, firewall, backups                     |
| K8s worker 1             | `192.168.4.205`   | Join cluster, storage, workloads                          |
| K8s worker 2             | `192.168.4.206`   | Join cluster, storage, workloads                          |
| K8s worker 3             | `192.168.4.207`   | Join cluster, storage, workloads                          |
| MetalLB VIP (entry)      | `192.168.4.204`   | LoadBalancer Service → nginx entry                        |
| Kong Gateway             | `192.168.4.209`   | Declarative config, TLS termination                       |
| Citrix ADC / Imperva WAF | _(site-specific)_ | Public VIP, WAF, SSL offload — **agent cannot configure** |

Traffic path:

```text
Internet
  → Citrix ADC / Imperva WAF (requirements only — operator)
    → Kong VM 192.168.4.209 :443
      → MetalLB VIP 192.168.4.204
        → entry nginx (namespace nexatech)
          → ClusterIP services (storefront, admin, 14 APIs)
PostgreSQL 192.168.4.208 ← apps via Secret *-database-url
```

## Citrix ADC / Imperva WAF — requirements & mapping (operator only)

> **BLOCKED_EXTERNAL:** Agent does not have ADC/WAF credentials or access. Document requirements for network team.

| Requirement        | Detail                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Backend pool       | Kong VM `192.168.4.209` HTTPS (or HTTP if TLS at ADC)                        |
| Health monitor     | HTTP GET Kong `/status` or storefront public URL `/`                         |
| SSL                | Public certificate for storefront/admin hostnames                            |
| Headers            | Preserve `X-Forwarded-For`, `X-Request-Id`; Kong sets correlation-id         |
| WAF rules          | OWASP CRS baseline; exclude large multipart for media upload paths if needed |
| Session stickiness | Not required (stateless APIs + Redis sessions)                               |
| Rate limit         | Optional at WAF; Kong rate limiting plugin optional M19+                     |

Route mapping (example):

| Public hostname             | ADC action              | Backend                     |
| --------------------------- | ----------------------- | --------------------------- |
| `shop.example.com`          | SSL VIP → pool          | Kong → VIP `.204:80`        |
| `shop.example.com/admin`    | Same VIP, path `/admin` | Kong → VIP `.204:3100`      |
| `shop.example.com/api/v1/*` | API pool                | Kong → VIP `.204:3001–3014` |

Coordinate `publicStorefrontUrl`, `publicAdminUrl`, `publicApiUrl` in Helm values with ADC hostnames.

## Phase 0 — Preconditions

- [ ] Change ticket approved
- [ ] `IMAGE_TAG` chosen (semver or git SHA — **not** `latest`)
- [ ] Docker Hub account ready
- [ ] `secret-values.yaml` prepared (gitignored) from `deploy/helm/nexatech/secret-values.example.yaml`
- [ ] PostgreSQL on `.208`: databases, users, grants, firewall allows `.205–207`
- [ ] MetalLB pool includes `.204`
- [ ] Kong VM `.209` reachable from ADC and from cluster network

## Phase 1 — Verify kube-context (mandatory before mutate)

```powershell
kubectl config current-context
kubectl config view --minify
kubectl get nodes -o wide
```

**Checklist:**

| Check        | Expected                                                     |
| ------------ | ------------------------------------------------------------ |
| Context name | Production cluster (document exact name in runbook appendix) |
| Nodes        | `.205`, `.206`, `.207` → `Ready`                             |
| Current user | Has deploy RBAC (not read-only)                              |
| Namespace    | `nexatech` exists or will be created                         |

If any check fails → **STOP**. Wrong cluster causes irreversible damage.

```powershell
# Safe unattended validation
helm lint deploy/helm/nexatech
helm template nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  --namespace nexatech > render.yaml
.\scripts\validate-production.ps1 -DryRun
```

## Phase 2 — Build and push images

**BLOCKED_EXTERNAL:** Requires `docker login` with operator credentials.

```powershell
docker login docker.io
$env:DOCKERHUB_USER = 'your-dockerhub-user'
$env:IMAGE_TAG = '0.17.0'
.\scripts\docker-build-all.ps1 -Push
```

Bash equivalent:

```bash
docker login docker.io
export DOCKERHUB_USER=your-dockerhub-user IMAGE_TAG=0.17.0
./scripts/docker-build-all.sh
PUSH=1 ./scripts/docker-build-all.sh
```

Verify migrate images: `nexatech-<service>:${IMAGE_TAG}-migrate` for all 14 backends.

Create pull Secret in cluster (once):

```powershell
kubectl create secret docker-registry dockerhub-pull -n nexatech `
  --docker-server=https://index.docker.io/v1/ `
  --docker-username=$env:DOCKERHUB_USER `
  --docker-password=$env:DOCKERHUB_TOKEN `
  --dry-run=client -o yaml | kubectl apply -f -
```

## Phase 3 — Kubernetes Secrets

**BLOCKED_EXTERNAL:** Real secret values.

```powershell
kubectl create namespace nexatech --dry-run=client -o yaml | kubectl apply -f -

# Preferred: from gitignored file
kubectl create secret generic nexatech-secrets -n nexatech `
  --from-env-file=./secret.env `
  --dry-run=client -o yaml | kubectl apply -f -

# Or Helm with private values file (never commit)
# helm upgrade ... -f secret-values.yaml
```

Required keys — see `deploy/helm/nexatech/secret-values.example.yaml` and `scripts/validate-production.*`.

## Phase 4 — Helm install / upgrade

**BLOCKED_EXTERNAL:** Mutates production cluster.

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  -f secret-values.yaml `
  --set global.imageRepository=$env:DOCKERHUB_USER `
  --set global.imageTag=$env:IMAGE_TAG `
  --namespace nexatech `
  --create-namespace `
  --wait --timeout 20m
```

Watch migrate Jobs:

```powershell
kubectl -n nexatech get jobs -w
kubectl -n nexatech wait --for=condition=complete job --all --timeout=600s
```

On failure → `docs/MIGRATIONS.md` + `docs/K8S-OPS.md` § Failed Job recovery. **Do not** skip failed migrations.

## Phase 5 — Verify entry VIP and internal health

```powershell
kubectl -n nexatech get svc nexatech-entry
curl http://192.168.4.204/healthz
curl http://192.168.4.204:3001/health/live
curl http://192.168.4.204:3003/health/ready
```

## Phase 6 — Kong on VM `.209`

**BLOCKED_EXTERNAL:** SSH to Kong VM.

1. Copy `infra/kong/kong.production.yml` to VM
2. Confirm all upstream URLs use `192.168.4.204` only
3. Apply declarative config (Kong version-specific command, e.g. `deck sync` or `kong config db_import`)
4. Reload / verify: admin `/status`
5. Test from VM: `curl http://192.168.4.204/healthz`

## Phase 7 — Production validation script

```powershell
$env:ENTRY_VIP = '192.168.4.204'
$env:BASE_URL = 'https://shop.example.com'   # if ADC/Kong public URL reachable
.\scripts\validate-production.ps1
```

Unreachable URLs from CI/agent → script reports **BLOCKED** (not a hard fail in dry-run mode).

## Phase 8 — Catalog seed (production-safe)

**BLOCKED_EXTERNAL** unless operator confirms.

```powershell
$env:NODE_ENV = 'production'
$env:CONFIRM_PRODUCTION = 'YES'
$env:CATALOG_DATABASE_URL = 'postgresql://nexatech_catalog:***@192.168.4.208:5432/nexatech_catalog?sslmode=prefer'
node scripts/seed-catalog-production.cjs --dry-run   # preview first
node scripts/seed-catalog-production.cjs             # execute when ready
```

Idempotent upserts — safe to re-run. Does **not** create weak admin passwords.

## Phase 9 — Smoke test (operator)

| Step       | Action                                                                |
| ---------- | --------------------------------------------------------------------- |
| Storefront | Load `/`, browse category                                             |
| API        | `GET /api/v1/catalog/products?page=1` via public URL                  |
| Admin      | Login with production admin (created separately — not by seed script) |
| Health     | All services green in validation script                               |

Optional: k6 smoke against staging/VIP (`docs/TESTING.md`).

## Rollback procedure

If deploy fails after partial rollout:

```powershell
helm history nexatech -n nexatech
helm rollback nexatech <previous-revision> -n nexatech --wait
kubectl -n nexatech get pods
.\scripts\validate-production.ps1 -DryRun
```

If migration already applied forward-only SQL: **database restore** from backup may be required — see `docs/BACKUP-RESTORE.md`. Do not run `migrate reset`.

Kong: restore previous declarative file from git tag.

## BLOCKED_EXTERNAL summary

| Action                                                         | Reason                                    |
| -------------------------------------------------------------- | ----------------------------------------- |
| `helm upgrade --install` on prod                               | Requires verified kube-context + operator |
| `kubectl apply` mutating prod                                  | Live infra risk                           |
| `docker push`                                                  | Docker Hub credentials                    |
| Kong apply on `.209`                                           | SSH / VM access                           |
| PostgreSQL DDL/users on `.208`                                 | DBA credentials                           |
| ADC / Imperva / TLS issuance                                   | External network team                     |
| MetalLB pool configuration                                     | Cluster infra                             |
| SMTP / VNPay / GHN / Google OAuth secrets                      | User-supplied                             |
| Backup restore to prod                                         | Destructive if mis-targeted               |
| `seed-catalog-production.cjs` without `CONFIRM_PRODUCTION=YES` | Guard intentional                         |

Agent **may** run: `helm lint`, `helm template`, `validate-production -DryRun`, `backup-postgres -DryRun`, `check-secret-leak`, local docker smoke, format/lint/test/build.

## Post-deploy

- [ ] Update change ticket / release notes with `IMAGE_TAG` and Helm revision
- [ ] Confirm backup cron on `.208` ran successfully
- [ ] Schedule restore drill (test DB)
- [ ] Archive rendered manifest: `helm get manifest nexatech -n nexatech > release-<tag>.yaml`

## Related documents

- `docs/DEPLOYMENT.md`
- `docs/MIGRATIONS.md`
- `docs/K8S-OPS.md`
- `docs/BACKUP-RESTORE.md`
- `docs/SECURITY-BASELINE.md`
- `docs/HANDOFF-M18.md`
