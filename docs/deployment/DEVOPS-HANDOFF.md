# DevOps handoff — NexaTech

**Status:** `READY_FOR_DEVOPS`
**Branch:** `fix/media-upload-profile-minimal-reset`
**Docs index:** [../README.md](../README.md)

This document is the operator entry point for packaging, deploy prerequisites, and smoke/rollback. It describes only paths and scripts that exist in this repository. Agents and developers must not push images, mutate live clusters, or apply Kong on production without operator credentials.

---

## 1. READY_FOR_DEVOPS status

Application engineering for this handoff is complete for DevOps packaging:

- Backend microservices, storefront, admin, Swagger portal, Security Guide portal
- Docker images / Helm charts / Kong declarative config
- Database create / migrate / seed / backup / verify / clean scripts
- Mailpit in local and E2E Compose; production SMTP via env placeholders
- Defect closures DEF-015, DEF-018, DEF-019 (see [../FINAL-LOCAL-RC-DEFECT-LEDGER.md](../FINAL-LOCAL-RC-DEFECT-LEDGER.md))

**Not included in development completion:** live cluster apply, registry push, MetalLB install, external PostgreSQL provisioning, or real Gmail SMTP credentials.

---

## 2. Required infrastructure prerequisites

| Prerequisite | Notes |
| ------------ | ----- |
| Kubernetes cluster | Workers for app workloads; dedicated node for Kong |
| MetalLB (or equivalent LB) | VIP for entry Service — see [../DEPLOYMENT-ORDER.md](../DEPLOYMENT-ORDER.md) |
| External PostgreSQL 16 | One database + app user per service — [../DATABASES.md](../DATABASES.md) |
| Container registry | Login for push/pull; imagePullSecret in namespace |
| Kong Gateway host/VM | Declarative config from `infra/kong/` |
| Optional SMTP | Gmail App Password or other SMTP for production email |
| Optional edge | Citrix ADC / Imperva — operator only ([../DEPLOY-RUNBOOK-PRODUCTION.md](../DEPLOY-RUNBOOK-PRODUCTION.md)) |

Node labelling helper: `scripts/deployment/label-nodes.ps1`
Topology diagram: [../architecture/kubernetes-deployment.md](../architecture/kubernetes-deployment.md)

---

## 3. Required environment variables

Copy and fill (never commit filled files):

| Template | Local copy (gitignored) |
| -------- | ----------------------- |
| `.env.deploy.local.example` | `.env.deploy.local` |
| `.env.e2e.example` | `.env.e2e` / `.env.e2e.local` |
| `.env.example` | local Compose / Nx as needed |

Deploy template highlights (names only — see `.env.deploy.local.example`):

- `KUBECONFIG` / optional SSH K8s access
- `K8S_APP_NODE_NAMES`, `KONG_NODE_NAME` / `KONG_NODE_IP`
- `CONTAINER_REGISTRY_*`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD`
- `NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN` (exact confirmation for destructive clean)
- `METALLB_ADDRESS_POOL`
- Public URL placeholders: `PUBLIC_BASE_URL`, `API_PUBLIC_URL`, …
- Optional SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_APP_PASSWORD`, …

Helm secret example: `deploy/helm/nexatech/secret-values.example.yaml`
Helm values examples: `deploy/helm/nexatech/values-example.yaml`, `values-production.yaml`

Loader used by deploy scripts: `scripts/deployment/_common.ps1` (`Import-NexaTechDeployEnv`).

---

## 4. Container image list

Canonical matrix: [../IMAGE-MATRIX.md](../IMAGE-MATRIX.md) (and `docs/image-matrix.json` if present).

Default tag strategy: **`0.17.0`** (never `latest`). Migrate images: `{tag}-migrate`.

| Group | Images |
| ----- | ------ |
| Frontends | `storefront-web`, `admin-web` |
| Backends | `identity-service`, `customer-service`, `catalog-service`, `media-service`, `inventory-service`, `cart-service`, `order-service`, `payment-service`, `shipping-service`, `review-service`, `warranty-service`, `support-service`, `notification-service`, `reporting-service` |
| Portals | `swagger-portal`, `security-guide-portal` |
| Migrate | one migrate image per Prisma backend via `deploy/docker/prisma-migrate.Dockerfile` |

Dockerfiles: `apps/<name>/Dockerfile`.

Build:

```powershell
pnpm docker:build:all
# or
pwsh -File scripts/images/build-all.ps1
pwsh -File scripts/docker-build-all.ps1
```

Tag / push / scan: `scripts/images/tag-all.ps1`, `push-all.ps1`, `scan-all.ps1` (push requires operator `docker login`).

---

## 5. Helm chart locations

| Chart | Path |
| ----- | ---- |
| Application | `deploy/helm/nexatech/` |
| Kong (in-cluster packaging) | `deploy/helm/kong/` |
| Observability (optional) | `deploy/helm/nexatech-observability/` |
| Environment overlays | `deploy/environments/production/values.yaml`, `deploy/environments/staging/values.yaml` |

Lint helper: `pnpm helm:lint` → `scripts/deployment/helm-lint.cjs`.

MetalLB templates: `deploy/metallb/namespace.yaml`, `deploy/metallb/ipaddresspool.yaml.tpl`.

---

## 6. Kong declarative configuration

| File | Purpose |
| ---- | ------- |
| `infra/kong/kong.yml` | Local / lab declarative config |
| `infra/kong/kong.production.yml` | Production-oriented declarative config |

Routing notes: [../architecture/kong-routing.md](../architecture/kong-routing.md).
Applying Kong on the live gateway VM is **operator-owned**.

---

## 7. PostgreSQL database / user model

See [../DATABASES.md](../DATABASES.md).

- PostgreSQL **16**
- **One database per service** (e.g. `nexatech_identity`, `nexatech_order`, …)
- **Dedicated app roles** (never application use of superuser `postgres`)
- Prisma migrations only (`migrate deploy`) — see [../MIGRATIONS.md](../MIGRATIONS.md)

Local Compose init reference: `infra/docker/postgres/init-databases.sql`
E2E init: `infra/docker/e2e-init-databases.sql`

Operator scripts:

```powershell
pwsh -File scripts/deployment/create-databases.ps1
pwsh -File scripts/deployment/verify-databases.ps1
```

---

## 8. Migration and seed sequence

Preferred contract order ([../DEPLOYMENT-ORDER.md](../DEPLOYMENT-ORDER.md)):

identity → customer → catalog/media → inventory → cart → order → payment/shipping → review/warranty/support → notification → reporting

```powershell
pwsh -File scripts/deployment/migrate-all.ps1
pwsh -File scripts/deployment/seed-required.ps1
# Catalog production seed (guarded):
node scripts/seed-catalog-production.cjs --dry-run
```

Helm runs per-service migrate Jobs as pre-install/pre-upgrade hooks (`deploy/helm/nexatech/templates/migrations-job.yaml`).
**Forbidden on production data:** `prisma migrate reset`, `prisma db push`, unattended destructive cleans without confirmation env.

---

## 9. Mailpit → Gmail SMTP switch

| Environment | Mechanism |
| ----------- | --------- |
| Local Compose | Mailpit in `infra/docker/docker-compose.dev.yml` |
| Isolated E2E | Mailpit in `infra/docker/docker-compose.e2e.yml` (host UI typically `:18025`) |
| Production / staging | Set `SMTP_*` from `.env.deploy.local.example` (Gmail App Password optional) |

Notification behaviour: [../use-cases/13-notification.md](../use-cases/13-notification.md).
Service implementation: `apps/notification-service` (SMTP sender; degraded mode when SMTP unset in production is documented in progress/ledger notes).

Do not commit real App Passwords. Keep them only in ignored `.env.deploy.local` / cluster Secrets.

---

## 10. Node labels and Kong-node taint

Documented in [../architecture/kubernetes-deployment.md](../architecture/kubernetes-deployment.md):

- App nodes: `nexatech.io/role=app`
- Kong node: `nexatech.io/role=kong` + taint `dedicated=kong:NoSchedule`
- Kong workloads tolerate that taint

```powershell
pwsh -File scripts/deployment/label-nodes.ps1
```

Requires filled `.env.deploy.local` node names.

---

## 11. Deployment sequence

Canonical narrative: [../DEPLOYMENT-ORDER.md](../DEPLOYMENT-ORDER.md) and [../DEPLOY-RUNBOOK-PRODUCTION.md](../DEPLOY-RUNBOOK-PRODUCTION.md).

Orchestrator (stops with `BLOCKED_EXTERNAL_INPUT` if vars missing):

```powershell
pwsh -File scripts/deployment/deploy-sequence.ps1 -DryRun
pwsh -File scripts/deployment/resume-from-checkpoint.ps1
```

High-level order:

1. Cluster audit / labels / taints
2. MetalLB pool
3. Create databases / users
4. Build/tag/push images (operator registry login)
5. Helm install/upgrade `deploy/helm/nexatech`
6. Migrate Jobs succeed before app traffic
7. Seed (guarded)
8. Apply Kong declarative config (operator)
9. Smoke tests

Checkpoints directory: `deploy/checkpoints/` (local artifacts; do not commit secrets).

---

## 12. Smoke-test commands

```powershell
# Static / packaging
pnpm helm:lint
pnpm openapi:validate
.\scripts\deploy-preflight.ps1 -DryRun -SkipKube -SkipConnectivity

# Release smoke (when cluster/URLs available)
.\scripts\smoke-release.ps1
.\scripts\validate-production.ps1

# Local Compose smoke helpers
node scripts/local-lab-smoke.cjs
node scripts/checkout-smoke.cjs

# Isolated E2E (not production DB)
pnpm e2e:setup
pnpm e2e:seed
pnpm e2e:run
pnpm e2e:teardown
```

Host Windows frontend production builds (must use production `NODE_ENV` via project targets):

```powershell
pnpm exec nx run storefront-web:build --configuration=production
pnpm exec nx run admin-web:build --configuration=production
```

---

## 13. Rollback procedure

See [../runbooks/rollback.md](../runbooks/rollback.md).

Summary:

```powershell
helm history nexatech -n nexatech
helm rollback nexatech <REVISION> -n nexatech
kubectl -n nexatech rollout status deploy --timeout=10m
```

Database restore: backup dumps via `scripts/deployment/backup-databases.ps1` / [../BACKUP-RESTORE.md](../BACKUP-RESTORE.md); verify with `scripts/deployment/verify-databases.ps1`.
Schema rollback is restore-based — not ad-hoc down migrations on production.

---

## 14. Secret file locations (never commit)

| Path | Rule |
| ---- | ---- |
| `.env.deploy.local` | gitignored |
| `.env.e2e.local` / `.env.e2e` | gitignored via `.env.*` |
| `.env.local` / `.env.*.local` | gitignored |
| `.secrets/` | gitignored (seeded accounts, credentials guides) |
| `deploy/helm/nexatech/secret-values.yaml` (if created locally) | do not commit; use `.example` only |
| Cluster Secrets / kubeconfig files | outside repo or ignored |

Tracked placeholders only: `.env.deploy.local.example`, `.env.e2e.example`, `.env.example`, `secret-values.example.yaml`.

Leak scan helpers: `scripts/check-secret-leak.ps1`, `scripts/check-secret-leak.sh`.

---

## 15. Current known non-development prerequisites

These remain **operator-owned** and block unattended production apply:

1. **Registry credentials** — `CONTAINER_REGISTRY_*` / `docker login`
2. **kubeconfig** — `KUBECONFIG` or working kubectl context
3. **MetalLB / VIP** — `METALLB_ADDRESS_POOL` and cluster LB capability
4. **External PostgreSQL** — host, admin user, network path, per-service DB grants
5. **Optional Gmail SMTP** — `SMTP_APP_PASSWORD` (or other SMTP) for real outbound mail

Until these are supplied, use `-DryRun` deploy scripts and local/E2E Compose only.

---

## Related

- [K8S-DEPLOYMENT-CHECKLIST.md](./K8S-DEPLOYMENT-CHECKLIST.md) — exact 30-step K8s sequence
- [INFRASTRUCTURE-INPUTS.md](./INFRASTRUCTURE-INPUTS.md) — input matrix
- [`../../deploy/images-manifest.txt`](../../deploy/images-manifest.txt) — image handoff manifest
- [../README.md](../README.md) — full documentation index
- [../PROGRESS.md](../PROGRESS.md) — engineering verdict
- [../FINAL-HANDOFF.md](../FINAL-HANDOFF.md) — milestone handoff
- [../TESTING.md](../TESTING.md) — test strategy
