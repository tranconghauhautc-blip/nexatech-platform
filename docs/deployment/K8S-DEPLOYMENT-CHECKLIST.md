# Kubernetes deployment checklist — NexaTech

**Audience:** DevOps / platform operators  
**Status:** handoff package for cluster deploy (do **not** run against production from agent automation)  
**Related:** [DEVOPS-HANDOFF.md](./DEVOPS-HANDOFF.md), [../DEPLOYMENT-ORDER.md](../DEPLOYMENT-ORDER.md), [../runbooks/rollback.md](../runbooks/rollback.md)

Fill [INFRASTRUCTURE-INPUTS.md](./INFRASTRUCTURE-INPUTS.md) / `.env.deploy.local` first. Scripts stop with `BLOCKED_EXTERNAL_INPUT` when required vars are missing.

---

## Exact sequence (existing repo commands)

### 1. Provision or verify the Kubernetes cluster

```powershell
# Uses KUBECONFIG from .env.deploy.local when set
kubectl get nodes -o wide
kubectl get ns
```

Orchestrator step: `scripts/deployment/deploy-sequence.ps1` → `01-cluster-audit`.

### 2. Verify containerd

```powershell
# On each node (operator SSH) — not automated in-repo:
# systemctl status containerd
# crictl info
kubectl get nodes -o wide
```

### 3. Verify all nodes

```powershell
kubectl get nodes -o wide
kubectl get nodes --show-labels
```

### 4. Label the three application nodes

```powershell
# Requires K8S_APP_NODE_NAMES (comma-separated) in .env.deploy.local
pwsh -File scripts/deployment/label-nodes.ps1
```

Labels applied: `nexatech.io/role=app`.

### 5. Label and taint the dedicated Kong node

Same script as step 4 (`KONG_NODE_NAME` or `KONG_NODE_IP`):

- Label: `nexatech.io/role=kong`
- Taint: `dedicated=kong:NoSchedule`

Kong chart tolerates this taint (`deploy/helm/kong/values.yaml`).

### 6. Verify StorageClass

```powershell
kubectl get storageclass
```

PVC sizes are declared under `platform.*.persistence` in `deploy/helm/nexatech/values.yaml`.

### 7. Install MetalLB when required

```powershell
# deploy-sequence.ps1 step 03-metallb when METALLB_ADDRESS_POOL is set
kubectl apply -f deploy/metallb/namespace.yaml
# Template: deploy/metallb/ipaddresspool.yaml.tpl (substitutes ${METALLB_ADDRESS_POOL})
```

Or run orchestrator:

```powershell
pwsh -File scripts/deployment/deploy-sequence.ps1
```

### 8. Create registry credentials

```powershell
docker login $env:CONTAINER_REGISTRY_URL -u $env:CONTAINER_REGISTRY_USERNAME -p $env:CONTAINER_REGISTRY_TOKEN
# Create imagePullSecret in namespace (operator):
kubectl -n nexatech create secret docker-registry dockerhub-pull `
  --docker-server=$env:CONTAINER_REGISTRY_URL `
  --docker-username=$env:CONTAINER_REGISTRY_USERNAME `
  --docker-password=$env:CONTAINER_REGISTRY_TOKEN
```

(See also deploy-sequence step `04-registry`.)

### 9. Retag and push immutable images

```powershell
pwsh -File scripts/images/build-all.ps1
pwsh -File scripts/images/scan-all.ps1
pwsh -File scripts/images/tag-all.ps1
pwsh -File scripts/images/push-all.ps1
# Alternatives:
pnpm docker:build:all
pwsh -File scripts/docker-build-all.ps1
```

**Never use tag `latest`.** Record tags in [../IMAGE-MATRIX.md](../IMAGE-MATRIX.md) / `deploy/images-manifest.txt`.

### 10. Verify Kubernetes nodes can reach external PostgreSQL

```powershell
# deploy-sequence step 06-postgres-check
psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -c 'SELECT version();'
```

### 11. Back up PostgreSQL

```powershell
pwsh -File scripts/deployment/backup-databases.ps1
# Also: scripts/backup-postgres.ps1 / scripts/backup-postgres.sh
```

### 12. Create service databases and users

```powershell
pwsh -File scripts/deployment/create-databases.ps1
pwsh -File scripts/deployment/verify-databases.ps1
```

Model: one DB + app role per service — [../DATABASES.md](../DATABASES.md). Never use superuser `postgres` for apps.

### 13. Run migration Jobs

Preferred (in-cluster Jobs via Helm hooks + host scripts):

```powershell
pwsh -File scripts/deployment/migrate-all.ps1
```

Helm: `deploy/helm/nexatech/templates/migrations-job.yaml` (`migrations.enabled: true`).  
**Forbidden:** `prisma migrate reset`, `prisma db push` on production data.

### 14. Run required seed Job

```powershell
pwsh -File scripts/deployment/seed-required.ps1
# Catalog dry-run only unless operator confirms production seed:
node scripts/seed-catalog-production.cjs --dry-run
```

Writes account **emails** to `.secrets/seeded-accounts.txt` (gitignored). Requires `REQUIRED_SEED_PASSWORD` / `NEXATECH_ALLOW_REQUIRED_SEED=YES`.

### 15–18. Deploy Redis, RabbitMQ, MinIO, optional Mailpit

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -n $env:HELM_NAMESPACE --create-namespace `
  -f deploy/environments/staging/values.yaml `
  --set global.postgresql.host=$env:POSTGRES_HOST `
  --wait --timeout 15m
```

Platform components live in the same chart (`platform.redis|rabbitmq|minio`). Staging Mailpit is Compose/lab-oriented; production SMTP via Secrets (see INFRASTRUCTURE-INPUTS).

### 19. Deploy Kong

```powershell
helm upgrade --install $env:HELM_KONG_RELEASE_NAME deploy/helm/kong `
  -n $env:HELM_NAMESPACE `
  -f deploy/environments/staging/values.yaml `
  --wait --timeout 10m
```

Declarative routes also exist at:

- Lab: `infra/kong/kong.yml`
- Production VM-oriented: `infra/kong/kong.production.yml`

Kong Admin API Service is **ClusterIP-only** (`deploy/helm/kong/values.yaml` → `admin.type: ClusterIP`).

### 20–24. Deploy backends, Storefront, Admin, Swagger Portal, Security Guide

Covered by the NexaTech Helm chart apps map (`deploy/helm/nexatech/values.yaml`):

- 14 Nest backends
- `storefront-web` (:3000)
- `admin-web` (:3100)
- `swagger-portal` (:8090)
- `security-guide-portal` (:3200)

Environment overlays: `deploy/environments/staging/values.yaml`, `deploy/environments/production/values.yaml`.

### 25. Wait for rollouts

```powershell
kubectl -n $env:HELM_NAMESPACE rollout status deploy --timeout=10m
kubectl -n $env:HELM_NAMESPACE get pods -o wide
```

### 26. Run health checks

```powershell
pwsh -File scripts/deployment/verify-databases.ps1
# Per-service live paths: /health/live (see IMAGE-MATRIX)
.\scripts\deploy-preflight.ps1
```

### 27. Run Kong smoke tests

```powershell
node scripts/local-lab-smoke.cjs
# With public URLs set for cluster:
.\scripts\smoke-release.ps1
```

Confirm routes use nested services (Kong 3.9+) and no duplicated `/api/v1/api/v1` prefixes.

### 28. Run deployment acceptance tests

```powershell
.\scripts\validate-production.ps1
pnpm openapi:validate
# Optional focused Playwright (not full 60-suite unless needed):
pnpm e2e:storefront
pnpm e2e:admin
```

### 29. Capture credentials and endpoints

Operator records (outside git):

- Public URLs: `PUBLIC_BASE_URL`, `API_PUBLIC_URL`, `ADMIN_PUBLIC_URL`, `SWAGGER_PUBLIC_URL`, `SECURITY_GUIDE_PUBLIC_URL`
- Seeded usernames from `.secrets/seeded-accounts.txt`
- Registry digests / image tags from `deploy/images-manifest.txt` / build checkpoints under `deploy/checkpoints/`

### 30. Verify rollback commands

```powershell
helm history nexatech -n nexatech
helm rollback nexatech <REVISION> -n nexatech
kubectl -n nexatech rollout status deploy --timeout=10m
```

Full runbook: [../runbooks/rollback.md](../runbooks/rollback.md). Database restore: [../BACKUP-RESTORE.md](../BACKUP-RESTORE.md).

---

## Orchestrator shortcut

```powershell
pwsh -File scripts/deployment/deploy-sequence.ps1 -DryRun
pwsh -File scripts/deployment/deploy-sequence.ps1
pwsh -File scripts/deployment/resume-from-checkpoint.ps1
```

---

## Packaging validation (no cluster)

```powershell
pnpm helm:lint
# Helm template via local helm or Docker alpine/helm (see scripts/deployment/helm-lint.cjs)
.\scripts\deploy-preflight.ps1 -DryRun -SkipKube -SkipConnectivity
.\scripts\validate-production.ps1   # when helm binary available
```

---

## Safe local E2E lab (not Kubernetes)

```powershell
docker compose -p nexatech-e2e `
  -f infra/docker/docker-compose.e2e.yml `
  -f infra/docker/docker-compose.e2e-apps.yml `
  up -d --build

powershell -File scripts/e2e/migrate.ps1
# seeds against *_test DBs only — see scripts/e2e/seed.ps1

# Shutdown (do not run during active handoff validation):
docker compose -p nexatech-e2e `
  -f infra/docker/docker-compose.e2e.yml `
  -f infra/docker/docker-compose.e2e-apps.yml `
  down --remove-orphans
```
