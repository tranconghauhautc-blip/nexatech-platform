# NexaTech Testing Strategy

## Mục tiêu

Mỗi milestone phải xanh:

1. Format
2. Lint
3. Unit test
4. Integration test phù hợp
5. Build

Toàn hệ thống (M20):

- API tests
- Playwright E2E
- k6 smoke/load
- Migration tests
- Docker image smoke

## Unit tests

- NestJS services/controllers/use-cases
- Domain pure functions (pricing rules, stock math, RBAC checks)
- Frontend utils/hooks (khi có logic)

Runner: Jest (Nx default) hoặc Vitest nếu Nx generator chọn — thống nhất trong monorepo tại M1.

## Integration tests

- Prisma + PostgreSQL test DB
- Redis cho session/OTP
- RabbitMQ publish/consume (testcontainer hoặc compose profile `test`)
- MinIO presign (optional)

## API tests

- Supertest / Pact-like contract từ `libs/shared/contracts`
- Cover auth, happy path checkout, error envelope

## E2E (Playwright)

Luồng tối thiểu:

1. Đăng ký / đăng nhập
2. Duyệt catalog → thêm giỏ
3. Checkout COD
4. Xem đơn
5. Admin cập nhật trạng thái cơ bản

## k6

- Smoke: health endpoints tất cả service
- Load nhẹ: product list + cart add
- Threshold lỗi và latency ghi trong `tests/k6/`

## Definition of Done mỗi milestone

- [ ] Code business thật (không placeholder rỗng)
- [ ] Format pass
- [ ] Lint pass
- [ ] Unit tests pass
- [ ] Integration tests liên quan pass (nếu có)
- [ ] Build pass
- [ ] Docs cập nhật
- [ ] Git commit cục bộ

## Lệnh chuẩn

```bash
pnpm format
pnpm lint
pnpm test
pnpm build
pnpm typecheck
```

Scripts dùng `cross-env NX_SKIP_NATIVE_FILE_CACHE=true NX_DAEMON=false` (xem ADR-018).

## Unit tests hiện có

| Project                | Coverage focus                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-platform`      | ID generation, assertDefined, pagination, constants                                                                                                                                                                                                                                                                                                                                                     |
| `shared-errors`        | Error envelope + AppError                                                                                                                                                                                                                                                                                                                                                                               |
| `shared-contracts`     | Pagination, auth schemas, category slugs                                                                                                                                                                                                                                                                                                                                                                |
| `shared-auth`          | RBAC ranks                                                                                                                                                                                                                                                                                                                                                                                              |
| `shared-events`        | Event envelope + routing keys                                                                                                                                                                                                                                                                                                                                                                           |
| `shared-config`        | Zod env loading                                                                                                                                                                                                                                                                                                                                                                                         |
| `shared-logging`       | Correlation + structured logger                                                                                                                                                                                                                                                                                                                                                                         |
| `identity-service`     | Register/login/OTP/refresh/reset                                                                                                                                                                                                                                                                                                                                                                        |
| `customer-service`     | Profile + addresses                                                                                                                                                                                                                                                                                                                                                                                     |
| `catalog-service`      | Catalog business + controller smoke; Prisma/migration khi có DB URL                                                                                                                                                                                                                                                                                                                                     |
| `media-service`        | Presign/ownership/MIME; Prisma/MinIO/migration khi có env                                                                                                                                                                                                                                                                                                                                               |
| `inventory-service`    | Warehouse/store/stock lifecycle, idempotency, low-stock event, concurrency (parallel reserve/issue); Prisma/migration/RabbitMQ khi có env                                                                                                                                                                                                                                                               |
| `cart-service`         | Guest/user cart, merge, ownership, idempotency, concurrency add, price refresh, inventory pre-check, convert; Prisma/migration/Redis khi có env                                                                                                                                                                                                                                                         |
| `order-service`        | Create from cart, re-price, reserve, snapshot, packages, state machine, cancel/confirm, ownership/RBAC, idempotency, concurrency, outbox; Prisma/migration khi có `ORDER_DATABASE_URL`                                                                                                                                                                                                                  |
| `payment-service`      | Payment intent COD/MOCK/VNPay, ownership, state machine, mock succeed/fail, VNPay signature/amount/replay, refund full/partial/double, outbox, order sync; Prisma/migration khi có `PAYMENT_DATABASE_URL`                                                                                                                                                                                               |
| `shipping-service`     | Quote/slot/shipment state machine, mock provider, webhook signature/replay, store pickup code, ownership/RBAC, outbox, order sync (`orderSyncedAt`); Prisma/migration khi có `SHIPPING_DATABASE_URL`                                                                                                                                                                                                    |
| `review-service`       | Verified buyer, lifecycle/moderation, media limits/ownership, reply RBAC, helpful idempotency/concurrency, duplicate report, aggregate math/rebuild, privacy, outbox; Prisma/migration khi có `REVIEW_DATABASE_URL`                                                                                                                                                                                     |
| `warranty-service`     | Claim/return state machines, verified buyer, evidence media ownership/MIME, staff transitions, order sync RETURN_REQUESTED/RETURNED, refund/inventory contract events only, outbox; Prisma/migration khi có `WARRANTY_DATABASE_URL`                                                                                                                                                                     |
| `support-service`      | Ticket state machine, customer/staff messages, media attachments ownership/MIME, assign/priority, ownership/RBAC, idempotency, version conflict, outbox; Prisma/migration khi có `SUPPORT_DATABASE_URL`                                                                                                                                                                                                 |
| `notification-service` | Template render, event extract/recipient routing, inbox idempotency, in-app ownership/RBAC, mark-read concurrency, email sender (InMemory/Logging/SMTP), REST request idempotency; Prisma/migration khi có `NOTIFICATION_DATABASE_URL`                                                                                                                                                                  |
| `reporting-service`    | Event domain mapping/metric key derivation (`event-handlers`), inbox idempotency + projection upsert + DailyMetric increment + audit projection (`reporting.service`), RBAC Staff+ (`REPORTING_FORBIDDEN`/`UNAUTHORIZED`), dashboard/projection/audit-log controllers, REST audit idempotency + conflict, consumer bind/nack DLX; Prisma/migration/Postgres integration khi có `REPORTING_DATABASE_URL` |
| `shared-web`           | `formatVnd`/`formatDateTimeVn`, `ApiClient` error envelope mapping, timeout, admin menu filter helpers, BFF path sanitize/timeout envelope                                                                                                                                                                                                                                                              |
| `storefront-web`       | Home/catalog/PDP/cart/checkout/auth/account pages; BFF proxy; session cookie; validation schemas; cart totals; Jest component/util tests                                                                                                                                                                                                                                                                |
| `admin-web`            | Login guard + RBAC menu; dashboard reporting; catalog/inventory/order/payment/shipping/review/warranty/support/notification/reporting/media list pages; users stub; Jest menu tests                                                                                                                                                                                                                     |

## Playwright E2E (M16)

```bash
pnpm exec playwright install chromium
pnpm e2e
# hoặc khi FE đã chạy:
# $env:PLAYWRIGHT_SKIP_WEBSERVER='1'; pnpm e2e
```

Specs: `e2e/storefront/*` (smoke, catalog/cart, responsive), `e2e/admin/smoke.spec.ts` (login + route guard + robots).

Backend thật qua Compose (khi có): seed catalog `pnpm seed:catalog` sau migrate; Kong `http://localhost:8000`.

## Integration (M4–M16)

Bật Compose rồi set `IDENTITY_DATABASE_URL`, `CUSTOMER_DATABASE_URL`, `CATALOG_DATABASE_URL`, `MEDIA_DATABASE_URL`, `MINIO_*`, `INVENTORY_DATABASE_URL`, `CART_DATABASE_URL`, `ORDER_DATABASE_URL`, `PAYMENT_DATABASE_URL`, `SHIPPING_DATABASE_URL`, `REVIEW_DATABASE_URL`, `WARRANTY_DATABASE_URL`, `SUPPORT_DATABASE_URL`, `NOTIFICATION_DATABASE_URL`, `REPORTING_DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL` (optional) trước `pnpm test`.
Tests tự skip nếu thiếu env — riêng notification M13 đã chạy integration với Postgres Compose thật (`61/61` khi có DB).

reporting-service M14 dự kiến **56+ test** (unit domain/metric mapping + controller RBAC + event-handlers extract/status + Prisma migration snapshot + Prisma integration + consumer bind/DLX), tương tự cấu trúc notification M13; chạy đủ khi có `REPORTING_DATABASE_URL`.

`inventory.concurrency.spec.ts` chạy song song nhiều lệnh `reserveStock`/`issueStock` bằng `InMemoryInventoryRepository` và khẳng định bất biến `reserved <= onHand` cùng `onHand >= 0` luôn đúng; các lần thất bại phải là `INVENTORY_INSUFFICIENT` hoặc `INVENTORY_CONFLICT`.

`cart.concurrency.spec.ts` thêm cùng SKU song song vào customer cart; tổng số lượng cuối cùng phải bằng số lần add (không lost update nhờ lock + optimistic version).

`payment.concurrency.spec.ts` xử lý callback trùng / song song; chỉ một lần chuyển `PAID`.

## Packaging validation (M17)

M17 bổ sung kiểm tra deploy artifact ngoài format/lint/test/build:

### Helm

```powershell
helm lint deploy/helm/nexatech
helm template nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  --namespace nexatech
```

- `helm lint` phải pass (0 errors)
- `helm template` render đủ: apps, entry LoadBalancer, platform ClusterIP, migrate Jobs hooks
- Agent **không** chạy `helm upgrade` lên cluster thật (BLOCKED_EXTERNAL)

### Docker smoke

```powershell
.\scripts\docker-build-all.ps1 -Image storefront-web
.\scripts\docker-build-all.ps1 -Image identity-service
# migrate image built automatically as identity-service:0.17.0-migrate
docker run --rm nexatech/storefront-web:0.17.0 node -e "console.log('ok')"
docker run --rm -e IDENTITY_DATABASE_URL='postgresql://...' nexatech/identity-service:0.17.0-migrate --help 2>$null; echo $LASTEXITCODE
```

Smoke tối thiểu M17: build thành công **storefront-web**, **identity-service**, và **identity-service:0.17.0-migrate**; container start không crash ngay.

### Nest runtime packaging (ADR-041)

Nx webpack (`generatePackageJson: true`) externalize Nest/runtime deps vào `dist/apps/<service>/package.json` + pruned `pnpm-lock.yaml`. Production Dockerfile **phải** materialize deps:

```text
pnpm exec nx build <service> --configuration=production
cd dist/apps/<service> && pnpm install --prod --frozen-lockfile --ignore-workspace
```

Generator: `scripts/m16-gen-dockerfiles.mjs` (regenerate toàn bộ `apps/*-service/Dockerfile`). `tslib` thuộc root **dependencies** (vì `importHelpers`). Không copy workspace `node_modules`; không `npm install` với lockfile pnpm.

Local Compose validation:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker compose -f infra/docker/docker-compose.apps.yml up -d --build
docker compose -f infra/docker/docker-compose.apps.yml ps -a
# Expect: 14 Nest + storefront + admin + Kong healthy; curl http://127.0.0.1:3001/health/live → {"status":"ok"}
```

Sau recreate frontend/backend, nếu Kong 502 do DNS cache upstream: `docker compose -f infra/docker/docker-compose.apps.yml restart kong`.

### Secret scan

Trước commit M17:

- Không file `.env` / credential thật trong git
- `secret-values.example.yaml` chỉ placeholder `REPLACE_*` / `CHANGE_ME_*`
- `values-production.yaml` có IP infra (`.208`, `.204`) nhưng **không** password
- Grep nhanh: `jwt-access-secret`, `postgresql://.*:.*@` trong tracked files → chỉ example

### kubectl (optional, dry-run only)

Nếu operator cung cấp kubeconfig read-only:

```powershell
helm template nexatech deploy/helm/nexatech -f deploy/helm/nexatech/values-production.yaml |
  kubectl apply --dry-run=client -f -
```

Không `kubectl apply` thật trong agent unattended.

## Release readiness validation (M19)

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:PATH = "$PWD\.tools\bin;$env:PATH"
.\scripts\deploy-preflight.ps1 -DryRun
.\scripts\smoke-release.ps1 -DryRun
.\scripts\validate-production.ps1
.\scripts\check-secret-leak.ps1
helm lint deploy/helm/nexatech
helm lint deploy/helm/nexatech-observability
helm template nexatech deploy/helm/nexatech -f deploy/helm/nexatech/values-production.yaml --namespace nexatech | Out-Null
```

| Asset                                             | Role                         |
| ------------------------------------------------- | ---------------------------- |
| `docs/IMAGE-MATRIX.md` / `docs/image-matrix.json` | Image inventory              |
| `docs/DEPLOYMENT-ORDER.md`                        | Install/upgrade order        |
| `docs/RELEASE-CHECKLIST.md`                       | Operator gate                |
| `docs/MIGRATIONS.md`                              | migrate deploy orchestration |

Smoke scripts refuse non-private targets (localhost / RFC1918 / `ENTRY_VIP` only). Tokens are never logged.

k6 load scenarios remain M20 (`tests/k6/`).

## Performance / reliability validation (M20)

```powershell
.\scripts\k6-validate.ps1
.\scripts\resilience-dry-run.ps1
.\scripts\backup-restore-validate.ps1
.\scripts\validate-alerts.ps1
```

## Security lab validation (M21)

```powershell
pnpm security:test:secure
$env:SECURITY_LAB_ACK='YES'; pnpm security:test:lab
pnpm security:validate
helm template nexatech-lab deploy/helm/nexatech -f deploy/helm/nexatech/values-security-lab.yaml -n nexatech-security-lab | Out-Null
```

Docs: `OWASP-SCENARIOS.md`, `SECURITY-LAB-ARCHITECTURE.md`, `FINAL-HANDOFF.md`.
