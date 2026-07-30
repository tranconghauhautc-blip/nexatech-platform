# NexaTech

NexaTech là nền tảng thương mại điện tử microservices bằng tiếng Việt, bán điện thoại, laptop, tablet, đồng hồ thông minh, tai nghe/loa và phụ kiện.

## Công nghệ

Nx 22.7.7 · pnpm · TypeScript strict · Next.js 15.2.4 · NestJS · Prisma · PostgreSQL 16 · Redis · RabbitMQ · MinIO · Kong · Docker · Kubernetes · Helm

## Tài liệu

| Tài liệu                                                               | Nội dung                  |
| ---------------------------------------------------------------------- | ------------------------- |
| [docs/PROGRESS.md](docs/PROGRESS.md)                                   | Tiến độ milestone         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                           | Kiến trúc hệ thống        |
| [docs/DECISIONS.md](docs/DECISIONS.md)                                 | Quyết định kỹ thuật       |
| [docs/API-CONTRACTS.md](docs/API-CONTRACTS.md)                         | Hợp đồng REST             |
| [docs/DATABASES.md](docs/DATABASES.md)                                 | Database per service      |
| [docs/EVENTS.md](docs/EVENTS.md)                                       | RabbitMQ events           |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                               | Deploy & runtime          |
| [docs/DEPLOY-RUNBOOK-PRODUCTION.md](docs/DEPLOY-RUNBOOK-PRODUCTION.md) | Runbook deploy infra thật |
| [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md)                       | Backup / restore          |
| [docs/K8S-OPS.md](docs/K8S-OPS.md)                                     | Kubernetes operations     |
| [docs/SECURITY-BASELINE.md](docs/SECURITY-BASELINE.md)                 | Security baseline         |
| [docs/TESTING.md](docs/TESTING.md)                                     | Chiến lược kiểm thử       |
| [docs/OWASP-SCENARIOS.md](docs/OWASP-SCENARIOS.md)                     | Kịch bản OWASP API (sau)  |
| [docs/IMAGE-MATRIX.md](docs/IMAGE-MATRIX.md)                           | Docker image matrix       |
| [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md)                 | Release gate checklist    |
| [docs/DEPLOYMENT-ORDER.md](docs/DEPLOYMENT-ORDER.md)                   | Deploy order              |
| [docs/PERFORMANCE-TESTING.md](docs/PERFORMANCE-TESTING.md)             | k6 / performance (M20)    |
| [docs/RESILIENCE-TESTING.md](docs/RESILIENCE-TESTING.md)               | Failure modes (M20)       |
| [docs/SLO-SLI.md](docs/SLO-SLI.md)                                     | SLI/SLO draft (M20)       |
| [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md)                 | DR assumptions (M20)      |
| [docs/INCIDENT-RESPONSE.md](docs/INCIDENT-RESPONSE.md)                 | Incident runbook (M20)    |

## Trạng thái

- **M0–M19** ✅
- **M20** 🔄 — performance / reliability / DR (`docs/PROGRESS.md`)

Chi tiết: `docs/PROGRESS.md`.

## Yêu cầu máy local

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose
- Git
- (Tuỳ chọn) Helm 3.16+, kubectl

## Lệnh thường dùng

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
pnpm install
pnpm format
pnpm lint
pnpm test
pnpm build
pnpm e2e
pnpm seed:catalog
.\scripts\docker-build-all.ps1 -Image identity-service
helm lint deploy/helm/nexatech
helm lint deploy/helm/nexatech-observability
.\scripts\validate-production.ps1
```

## Deploy packaging

- Apps chart: `deploy/helm/nexatech` (v0.17.0)
- Observability chart: `deploy/helm/nexatech-observability` (v0.18.0)
- Kong production: `infra/kong/kong.production.yml` → MetalLB VIP `192.168.4.204`
- Operator runbook: `docs/DEPLOY-RUNBOOK-PRODUCTION.md`
