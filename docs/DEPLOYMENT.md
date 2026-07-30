# NexaTech Deployment

## Môi trường

| Env           | Mục đích        | Orchestration                         |
| ------------- | --------------- | ------------------------------------- |
| `local`       | Dev máy cá nhân | Docker Compose + Nx serve             |
| `integration` | Test tích hợp   | Compose full stack                    |
| `production`  | Kubernetes      | Helm `deploy/helm/nexatech` + Kong VM |

## Nguyên tắc

- Mỗi app có Dockerfile riêng (Linux multi-stage)
- Không hard-code IP/domain/secret trong source app
- Env var + schema validation (`libs/shared/config`)
- Image tag semver/git-sha — **không** dùng `latest`
- App DB user riêng per service (không role `postgres`)
- Health/live/ready bắt buộc trước khi nhận traffic
- Container non-root UID **10001** (Nest + migrate images)
- `prisma migrate deploy` only trên production — không `db push` / `migrate reset`

## Local dependencies (Compose)

Services hạ tầng tối thiểu:

- PostgreSQL 16 (nhiều database)
- Redis 7
- RabbitMQ 3.13+ (management plugin)
- MinIO
- Mailhog / Mailpit (dev email)
- Kong (local qua `docker-compose.apps.yml`)

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker network create nexatech-dev 2>$null
docker compose -f infra/docker/docker-compose.apps.yml up -d --build
```

## Dockerfile pattern

```text
deps → build (Nx) → production runtime (node slim, USER 10001)
```

Mỗi service expose:

- HTTP port riêng (map qua env `PORT`)
- `/health`, `/health/live`, `/health/ready`
- Nest: `app.enableShutdownHooks()` cho graceful shutdown

Tag mặc định M17: **`0.17.0`**.

## Build và push images (M17)

Scripts catalog:

| Script                         | OS         | Ghi chú                        |
| ------------------------------ | ---------- | ------------------------------ |
| `scripts/docker-build-all.ps1` | PowerShell | Build all hoặc `-Image <name>` |
| `scripts/docker-build-all.sh`  | Bash       | `--image <name>`, `--push`     |

Biến môi trường:

- `IMAGE_TAG` — mặc định `0.17.0` hoặc git SHA khi `-UseGitSha` / `--use-git-sha`
- `IMAGE_REPOSITORY` — mặc định `nexatech`
- `DOCKERHUB_USER` — prefix registry khi push (`docker.io/<user>/nexatech-<app>:<tag>`)

Ví dụ:

```powershell
# Build tất cả app + migrate images (local tag nexatech/<app>:0.17.0)
.\scripts\docker-build-all.ps1

# Một service + migrate
.\scripts\docker-build-all.ps1 -Image identity-service

# Push (operator phải docker login trước — script KHÔNG login)
$env:DOCKERHUB_USER='your-dockerhub-user'
$env:IMAGE_TAG='0.17.0'
.\scripts\docker-build-all.ps1 -Push
```

```bash
./scripts/docker-build-all.sh --image storefront-web
DOCKERHUB_USER=your-dockerhub-user IMAGE_TAG=0.17.0 ./scripts/docker-build-all.sh --push
```

Migrate image (mỗi backend Prisma):

```text
deploy/docker/prisma-migrate.Dockerfile
→ nexatech/<service>:<tag>-migrate
```

Build migrate tự động khi build backend (trừ `-SkipMigrate` / `--skip-migrate`).

## Kong

### Local (`infra/kong/kong.yml`)

- Compose service `kong` trong `docker-compose.apps.yml` (proxy `:8000`, admin `:8001`)
- Upstream trực tiếp tới tên service Compose
- Routes:
  - `/` → storefront-web
  - `/admin` → admin-web (`strip_path: true`)
  - `/api/v1/*`, `/api/v2/*` → microservices (`strip_path: false`)
- Plugins: cors, correlation-id (`x-request-id`)

### Production (`infra/kong/kong.production.yml`)

- Kong chạy trên **VM riêng** `192.168.4.209` (ngoài cluster)
- Mọi upstream trỏ **MetalLB VIP** `192.168.4.204` (port theo entry Service)
- Cùng route map như local: `/`, `/admin`, `/api/v1`, `/api/v2`
- Kong **không** deploy trong Helm chart M17 — chỉ file declarative + operator apply trên VM

```text
Internet / LAN
    → Kong VM (.209) :443/:8000
        → MetalLB VIP (.204)
            → entry nginx (LoadBalancer)
                → ClusterIP services (storefront, admin, APIs)
```

## Helm chart (M17)

Path: **`deploy/helm/nexatech`**

| File                         | Vai trò                                      |
| ---------------------------- | -------------------------------------------- |
| `Chart.yaml`                 | Chart version **0.17.0**                     |
| `values.yaml`                | Default dev/small cluster                    |
| `values-example.yaml`        | Kind/local — Postgres in-cluster placeholder |
| `values-production.yaml`     | Production overlay — IP `.208`, VIP `.204`   |
| `secret-values.example.yaml` | Mẫu key Secret (không commit giá trị thật)   |

Templates chính:

- `apps-deployment.yaml` / `apps-service.yaml` — 16 workloads (2 FE + 14 Nest)
- `entry.yaml` — nginx entry + LoadBalancer VIP
- `migrations-job.yaml` — Prisma migrate hooks
- `platform-redis.yaml`, `platform-rabbitmq.yaml`, `platform-minio.yaml`
- `configmap.yaml`, `serviceaccount.yaml`, `apps-hpa-pdb.yaml`, `networkpolicy-ready.yaml`

### Workloads

- **Apps:** Deployment + ClusterIP Service + probes + `securityContext` (runAsUser 10001)
- **Entry:** Deployment nginx-unprivileged + Service `LoadBalancer` + `loadBalancerIP` (MetalLB)
- **Platform:** Redis, RabbitMQ, MinIO — **ClusterIP only**; RabbitMQ management và MinIO console không public
- **Migrate:** Job per Prisma service, image tag `${global.imageTag}-migrate`

### MetalLB / entry mapping

Production (`values-production.yaml`):

```yaml
entry:
  enabled: true
  loadBalancerIP: '192.168.4.204'
  serviceType: LoadBalancer
  exposeApiPorts: true
  annotations:
    metallb.universe.tf/allow-shared-ip: nexatech-entry
```

Entry Service publish:

| Port      | Target              | Kong upstream        |
| --------- | ------------------- | -------------------- |
| 80        | storefront-web:3000 | `http://.204:80`     |
| 3100      | admin-web:3100      | `http://.204:3100`   |
| 3001–3014 | API services        | `http://.204:<port>` |

App Deployments giữ ClusterIP; chỉ entry nhận traffic từ Kong qua VIP.

### External PostgreSQL

Host **`192.168.4.208`** chỉ trong `values-production.yaml`:

```yaml
global:
  postgresql:
    host: '192.168.4.208'
    port: 5432
    sslMode: prefer
```

Connection string đầy đủ nằm trong Secret (`*-database-url`), không trong values công khai.

### Helm commands (operator)

```powershell
# Lint + render (safe unattended)
helm lint deploy/helm/nexatech
helm template nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  --namespace nexatech > render.yaml

# Deploy thật — BLOCKED_EXTERNAL cho agent unattended
helm upgrade --install nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  --namespace nexatech --create-namespace
```

Trước upgrade: tạo Secret `nexatech-secrets` từ `secret-values.example.yaml` (xem bên dưới).

## Secrets (không commit)

Mẫu: `deploy/helm/nexatech/secret-values.example.yaml`

Tạo Secret (operator):

```powershell
kubectl create namespace nexatech
kubectl create secret generic nexatech-secrets -n nexatech `
  --from-literal=jwt-access-secret='...' `
  --from-literal=identity-database-url='postgresql://nexatech_identity:...@192.168.4.208:5432/nexatech_identity?sslmode=prefer'
# ... các key còn lại
```

Keys bắt buộc tối thiểu:

- JWT: `jwt-access-secret`, `jwt-refresh-secret`, `admin-session-secret`
- DB: `identity-database-url`, … `reporting-database-url` (14 service)
- Platform: `redis-url`, `rabbitmq-url`, `minio-access-key`, `minio-secret-key`
- Tích hợp (khi bật): Google OAuth, SMTP, VNPay, GHN

`values-production.yaml` dùng placeholder `CHANGE_ME_DOCKERHUB_USER`, `CHANGE_ME_PUBLIC_HOST` — override qua `-f secret-values.yaml` (gitignored) hoặc `--set`.

## Prisma migration hooks

Chi tiết: **`docs/MIGRATIONS.md`**

- Hook: `pre-install,pre-upgrade`
- `backoffLimit: 1`, `hook-delete-policy: before-hook-creation,hook-succeeded`
- Một Job per service có `dbEnv`
- Image: `<registry>/<repo>/<service>:<tag>-migrate`
- Chỉ `prisma migrate deploy` — cấm reset/push trên production

Sau failure:

```powershell
kubectl -n nexatech logs job/identity-service-migrate
kubectl -n nexatech delete job identity-service-migrate
helm upgrade ...  # re-run hooks
```

## Production infra topology (M17)

| Thành phần        | IP / vị trí         | Ghi chú                      |
| ----------------- | ------------------- | ---------------------------- |
| PostgreSQL        | `192.168.4.208`     | External VM, 14 DB app users |
| Kong Gateway      | `192.168.4.209`     | VM, declarative config       |
| MetalLB VIP entry | `192.168.4.204`     | LoadBalancer → nginx entry   |
| K8s workers       | `192.168.4.205–207` | Node pool (Helm workloads)   |

Redis, RabbitMQ, MinIO: in-cluster ClusterIP — truy cập nội bộ namespace `nexatech` only.

## Seed catalog (local / staging)

```powershell
cd apps/catalog-service
npx prisma migrate deploy
npx prisma generate
$env:CATALOG_DATABASE_URL='postgresql://nexatech_catalog:changeme@localhost:5432/nexatech_catalog'
pnpm seed:catalog
```

Production seed: xem M18 (production-safe seed runbook).

## Image registry

```text
docker.io/<DOCKERHUB_USER>/nexatech-<app>:<version>
docker.io/<DOCKERHUB_USER>/nexatech-<app>:<version>-migrate
```

Push chỉ khi operator cung cấp Docker Hub credentials và chạy `docker login` thủ công.

## Validation đã chạy (M17)

| Kiểm tra                      | Kết quả                                       |
| ----------------------------- | --------------------------------------------- |
| format / lint / test / build  | OK                                            |
| `helm lint` + `helm template` | OK                                            |
| Docker smoke                  | storefront-web, identity-service, migrate OK  |
| `kubectl apply` thật          | **BLOCKED_EXTERNAL** — không cluster xác minh |
| Secret scan git               | Không secret thật trong repo                  |

Deploy production thật (`helm upgrade`, Kong VM apply, MetalLB) thuộc M18 runbook với operator on-site.
