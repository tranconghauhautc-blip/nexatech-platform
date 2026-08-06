# NexaTech documentation index

Entry point for application and DevOps handoff documentation.
Engineering status: see [PROGRESS.md](./PROGRESS.md) and [deployment/DEVOPS-HANDOFF.md](./deployment/DEVOPS-HANDOFF.md).

## Use cases

| Document | Description |
| -------- | ----------- |
| [use-cases/COVERAGE-MATRIX.md](./use-cases/COVERAGE-MATRIX.md) | Use-case coverage matrix |
| [use-cases/00-system-overview.md](./use-cases/00-system-overview.md) | System overview |
| [use-cases/01-identity.md](./use-cases/01-identity.md) | Identity / auth |
| [use-cases/02-customer.md](./use-cases/02-customer.md) | Customer profile |
| [use-cases/03-catalog-media.md](./use-cases/03-catalog-media.md) | Catalog and media |
| [use-cases/04-inventory.md](./use-cases/04-inventory.md) | Inventory |
| [use-cases/05-cart-commerce.md](./use-cases/05-cart-commerce.md) | Cart / wishlist / compare |
| [use-cases/06-checkout-order.md](./use-cases/06-checkout-order.md) | Checkout and order |
| [use-cases/07-payment.md](./use-cases/07-payment.md) | Payment |
| [use-cases/08-shipping-standard.md](./use-cases/08-shipping-standard.md) | Standard Shipping |
| [use-cases/09-store-pickup.md](./use-cases/09-store-pickup.md) | Store Pickup |
| [use-cases/10-review.md](./use-cases/10-review.md) | Reviews |
| [use-cases/11-warranty-return.md](./use-cases/11-warranty-return.md) | Warranty and returns |
| [use-cases/12-support.md](./use-cases/12-support.md) | Support tickets |
| [use-cases/13-notification.md](./use-cases/13-notification.md) | Notifications / email |
| [use-cases/14-reporting.md](./use-cases/14-reporting.md) | Reporting |
| [use-cases/15-admin-rbac.md](./use-cases/15-admin-rbac.md) | Admin RBAC |
| [use-cases/16-api-gateway-bff.md](./use-cases/16-api-gateway-bff.md) | API gateway / BFF |

## Architecture diagrams and flows

| Document | Description |
| -------- | ----------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture overview |
| [architecture/microservice-architecture.md](./architecture/microservice-architecture.md) | Microservice architecture |
| [architecture/checkout-flow.md](./architecture/checkout-flow.md) | Checkout flow |
| [architecture/standard-shipping.md](./architecture/standard-shipping.md) | Standard Shipping flow |
| [architecture/store-pickup.md](./architecture/store-pickup.md) | Store Pickup flow |
| [architecture/kong-routing.md](./architecture/kong-routing.md) | Kong routing |
| [architecture/kubernetes-deployment.md](./architecture/kubernetes-deployment.md) | Kubernetes deployment topology |
| [use-cases/07-payment.md](./use-cases/07-payment.md) | Payment flow (use-case) |
| [use-cases/13-notification.md](./use-cases/13-notification.md) | Notification flow (use-case) |
| [use-cases/10-review.md](./use-cases/10-review.md) | Review flow (use-case) |
| [use-cases/11-warranty-return.md](./use-cases/11-warranty-return.md) | Warranty and return flow (use-case) |
| [use-cases/12-support.md](./use-cases/12-support.md) | Support flow (use-case) |
| [EVENTS.md](./EVENTS.md) | Async event contracts |
| [INVENTORY-ORDER-CONSISTENCY.md](./INVENTORY-ORDER-CONSISTENCY.md) | Inventory ↔ order consistency |

## Deployment and DevOps

| Document | Description |
| -------- | ----------- |
| [deployment/DEVOPS-HANDOFF.md](./deployment/DEVOPS-HANDOFF.md) | **DevOps handoff (start here)** |
| [deployment/K8S-DEPLOYMENT-CHECKLIST.md](./deployment/K8S-DEPLOYMENT-CHECKLIST.md) | Exact K8s deploy sequence (30 steps) |
| [deployment/INFRASTRUCTURE-INPUTS.md](./deployment/INFRASTRUCTURE-INPUTS.md) | DevOps/System input matrix |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment principles and local Compose |
| [deployment/lan-ip-first.md](./deployment/lan-ip-first.md) | LAN / IP-first exposure |
| [DEPLOYMENT-ORDER.md](./DEPLOYMENT-ORDER.md) | Ordered install / upgrade steps |
| [DEPLOY-RUNBOOK-PRODUCTION.md](./DEPLOY-RUNBOOK-PRODUCTION.md) | Production operator runbook |
| [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) | Deployment checklist |
| [K8S-OPS.md](./K8S-OPS.md) | Kubernetes operations |
| [K8S-MIGRATION-READINESS.md](./K8S-MIGRATION-READINESS.md) | K8s migration readiness |
| [IMAGE-MATRIX.md](./IMAGE-MATRIX.md) | Container image matrix |
| [`deploy/images-manifest.txt`](../deploy/images-manifest.txt) | Image handoff manifest (tag/port/health) |
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | Release checklist |
| [runbooks/rollback.md](./runbooks/rollback.md) | Rollback runbook |

## Databases, migrations, backup, seed

| Document | Description |
| -------- | ----------- |
| [DATABASES.md](./DATABASES.md) | Per-service databases and users |
| [MIGRATIONS.md](./MIGRATIONS.md) | Prisma migrate deploy runbook |
| [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) | Backup and restore |
| [runbooks/database-clean.md](./runbooks/database-clean.md) | Database clean procedure |
| [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) | Disaster recovery |

Related scripts (repo root):

- `scripts/deployment/create-databases.ps1`
- `scripts/deployment/migrate-all.ps1`
- `scripts/deployment/seed-required.ps1`
- `scripts/deployment/verify-databases.ps1`
- `scripts/deployment/backup-databases.ps1`
- `scripts/deployment/clean-databases.ps1`
- `scripts/seed-catalog-production.cjs`
- `scripts/seed-accounts.cjs` / `scripts/seed-customers.cjs`

## Email (Mailpit → production SMTP)

| Resource | Description |
| -------- | ----------- |
| [use-cases/13-notification.md](./use-cases/13-notification.md) | Notification / email behaviour |
| [LOCAL-LAB-LINKS.md](./LOCAL-LAB-LINKS.md) | Local lab URLs including Mailpit |
| `.env.deploy.local.example` | Optional Gmail SMTP placeholders (`SMTP_*`) |
| `infra/docker/docker-compose.dev.yml` | Dev Mailpit service |
| `infra/docker/docker-compose.e2e.yml` | Isolated E2E Mailpit |

## API, Swagger, Security Guide

| Document | Description |
| -------- | ----------- |
| [API-CONTRACTS.md](./API-CONTRACTS.md) | API contracts |
| [OPENAPI-GUIDE.md](./OPENAPI-GUIDE.md) | OpenAPI workflow |
| [SWAGGER-LINKS.md](./SWAGGER-LINKS.md) | Swagger portal links |
| [SWAGGER-OPENAPI-CURRENT-STATE.md](./SWAGGER-OPENAPI-CURRENT-STATE.md) | Current OpenAPI state |
| [SECURITY-GUIDE-SETUP.md](./SECURITY-GUIDE-SETUP.md) | Security Guide setup |
| [SECURITY-GUIDE-AUTHENTICATION.md](./SECURITY-GUIDE-AUTHENTICATION.md) | Security Guide auth |
| [OWASP-SCENARIOS.md](./OWASP-SCENARIOS.md) | OWASP scenarios |
| [SECURITY-BASELINE.md](./SECURITY-BASELINE.md) | Security baseline |

OpenAPI artifacts: `openapi/*.openapi.yaml` and `openapi/*.openapi.json`.

## Testing and E2E

| Document / script | Description |
| ----------------- | ----------- |
| [TESTING.md](./TESTING.md) | Testing strategy |
| [FINAL-LOCAL-RC-DEFECT-LEDGER.md](./FINAL-LOCAL-RC-DEFECT-LEDGER.md) | Local RC defect ledger |
| `pnpm e2e:setup` → `scripts/e2e/setup.ps1` | Isolated E2E stack |
| `pnpm e2e:seed` → `scripts/e2e/seed.ps1` | E2E seed |
| `pnpm e2e:run` → `scripts/e2e/run.ps1` | Playwright against E2E |
| `pnpm e2e:teardown` → `scripts/e2e/teardown.ps1` | Tear down E2E |
| `.env.e2e.example` | E2E environment template |

## Image build and scan

| Script | Description |
| ------ | ----------- |
| `pnpm docker:build:all` / `scripts/images/build-all.ps1` | Build all app images |
| `scripts/images/tag-all.ps1` | Retag images |
| `scripts/images/push-all.ps1` | Push (operator login required) |
| `scripts/images/scan-all.ps1` | Scan images |
| `scripts/docker-build-all.ps1` / `.sh` | Alternate full build entry |

## Environment templates (tracked examples only)

| File | Purpose |
| ---- | ------- |
| `.env.example` | Local development template |
| `.env.deploy.local.example` | Deploy / K8s operator template |
| `.env.e2e.example` | Isolated E2E template |
| `.env.nx` | Safe Nx local tweaks (committed) |
| `deploy/helm/nexatech/values-example.yaml` | Helm values example |
| `deploy/helm/nexatech/secret-values.example.yaml` | Helm secret values example |

**Never commit:** `.env.deploy.local`, `.env.e2e.local`, `.env.*.local`, `.secrets/`.

## Known DevOps prerequisites (operator-owned)

Documented in [deployment/DEVOPS-HANDOFF.md](./deployment/DEVOPS-HANDOFF.md):

- Container registry credentials
- `KUBECONFIG` / cluster access
- MetalLB address pool / VIP
- External PostgreSQL host, admin credentials, per-service DBs/users
- Optional Gmail SMTP App Password for production email

## Decisions and progress

| Document | Description |
| -------- | ----------- |
| [DECISIONS.md](./DECISIONS.md) | Architecture decisions |
| [PROGRESS.md](./PROGRESS.md) | Current progress / verdict |
| [FINAL-HANDOFF.md](./FINAL-HANDOFF.md) | Milestone handoff summary |
| [KNOWN-LIMITATIONS.md](./KNOWN-LIMITATIONS.md) | Known limitations |
