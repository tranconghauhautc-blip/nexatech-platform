# NexaTech Architecture Decisions

Các quyết định kỹ thuật đã chốt. Không hỏi lại trừ khi có thay đổi phạm vi sản phẩm.

## ADR-001 — Nx integrated monorepo + pnpm

- **Quyết định:** Dùng Nx integrated monorepo, package manager `pnpm`.
- **Lý do:** Quản lý nhiều apps/libs, caching build/test, dependency graph rõ.
- **Hệ quả:** Tất cả app nằm trong `apps/`, shared code trong `libs/`.

## ADR-002 — NestJS cho backend, Next.js cho frontend

- **Quyết định:** 14 microservices NestJS; `storefront-web` và `admin-web` dùng Next.js App Router.
- **Lý do:** Phù hợp REST/Swagger, module hóa, SSR/SSG storefront tiếng Việt.

## ADR-003 — Database per service (PostgreSQL 16 + Prisma)

- **Quyết định:** Mỗi service có schema/database riêng; Prisma + migrations.
- **Cấm:** `prisma db push` trên production; dùng chung bảng giữa service; dùng user `postgres` cho app.
- **Lý do:** Bounded context rõ, độc lập deploy/migrate.

## ADR-004 — Sync REST + Async RabbitMQ

- **Quyết định:** Đồng bộ qua REST; sự kiện miền qua RabbitMQ topic exchanges.
- **Lý do:** Checkout/read cần sync; email, audit, stock side-effects dùng async.

## ADR-005 — API versioning `/api/v1` và `/api/v2`

- **Quyết định:** Mọi HTTP API public đi qua prefix version.
- **Lý do:** Cho phép evolve contract mà không phá client cũ. Ban đầu `v1` là primary; `v2` sẵn sàng mirror/compat khi cần.

## ADR-006 — Auth JWT + session store

- **Quyết định mục tiêu:** Access token JWT ngắn hạn; refresh token + session/device lưu Redis.
- **Trạng thái M3:** Session/OTP/user đang ở **InMemoryIdentityStore** để unit test/build không cần DB/Redis.
- **Prisma schema** đã mô hình `User`, `Session`, `Device`, `OtpChallenge`, `OAuthAccount`.
- **Bước tiếp:** Prisma repository + Redis session khi chạy Compose/migrate (không chặn M4 catalog).

## ADR-019 — In-memory repository trước, Prisma schema sẵn

- **Quyết định (M3):** Service Nest dùng interface store (`IdentityStore`, `CustomerStore`) với implementation in-memory mặc định; Prisma schema nằm cạnh app.
- **Lý do:** Lint/test/build xanh không phụ thuộc Postgres local; vẫn giữ contract DB cho migrate sau.
- **Cấm:** Coi in-memory là persistence production.
- **Cập nhật M4:** Xem ADR-023 — catalog/media bắt buộc Prisma repository thật.

## ADR-020 — Nest URI versioning + health ngoài prefix api

- **Quyết định:** `enableVersioning({ type: URI })` → `/api/v1/...`, `/api/v2/...`.
- Health: `/health`, `/health/live`, `/health/ready` **exclude** khỏi global prefix `api`.
- Swagger: `/docs` mỗi service.
- Ports mặc định: identity `3001`, customer `3002`, catalog `3003`, media `3004`, inventory `3005`, cart `3006`, order `3007`, payment `3008`, shipping `3009`.

## ADR-021 — Customer auth tạm bằng header

- **Quyết định tạm (M3):** `customer-service` nhận `x-user-id` / `x-user-name` header.
- **Lý do:** Chưa có JWT guard/gateway shared giữa service.
- **M4:** catalog admin và media dùng `x-user-id` + `x-user-roles` (comma-separated) tạm thời.
- **Mục tiêu sau:** Guard JWT + Kong; bỏ header giả lập trước production.

## ADR-022 — Prisma client output trong app

- **Quyết định:** `generator client { output = "../src/generated/prisma" }` per service.
- Env URL: `IDENTITY_DATABASE_URL`, `CUSTOMER_DATABASE_URL`, `CATALOG_DATABASE_URL`, `MEDIA_DATABASE_URL`, `INVENTORY_DATABASE_URL`, `CART_DATABASE_URL`, `ORDER_DATABASE_URL`, `PAYMENT_DATABASE_URL`, `SHIPPING_DATABASE_URL`.
- App DB users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media`, `nexatech_inventory`, `nexatech_cart`, `nexatech_order`, `nexatech_payment`, `nexatech_shipping` (không dùng role `postgres` cho app).
- Generated client gitignore `apps/*/src/generated/`; target `prisma-generate` trước build/test.

## ADR-023 — Persistence thật cho catalog/media (M4)

- **Quyết định:** Business code phụ thuộc repository interface; runtime dùng Prisma + PostgreSQL khi có `*_DATABASE_URL`.
- In-memory chỉ là test double (unit test / `NODE_ENV=test`).
- Media object storage: MinIO thật qua adapter `ObjectStorage`; in-memory storage chỉ cho unit test.
- Migrations committed; cấm `prisma db push` production và cấm agent tự `migrate reset`.
- PostgreSQL full-text search catalog: cột `searchVector` (tsvector generated) + GIN index trong migration SQL.

## ADR-024 — Inventory optimistic lock + idempotency (M5)

- **Quyết định:** `StockItem.version` dùng optimistic locking (UPDATE có `WHERE version=?`, retry tối đa 3 lần).
- Mọi thao tác biến động tồn (receive/issue/reserve/transfer/adjust) bắt buộc `idempotencyKey` lưu `IdempotencyRecord`.
- `available = onHand - reserved`; cấm âm và cấm `reserved > onHand`.
- Events publish qua RabbitMQ topic `nexatech.events` khi có `RABBITMQ_URL`; unit test dùng `InMemoryEventPublisher`.
- Location: `warehouse` và `store` cùng model tồn theo `(skuCode, locationType, locationId)`.

## ADR-025 — Cart persistence + Redis assist (M6)

- **Quyết định:** Guest và customer cart lưu PostgreSQL (`nexatech_cart`) qua Prisma repository. Redis dùng hỗ trợ: idempotency NX, distributed lock theo cart owner, cache TTL guest token — **không** là nguồn sự thật duy nhất cho customer cart.
- Guest nhận diện bằng `cart token` (random 32 bytes, lưu **hash SHA-256**); TTL mặc định 30 ngày; status lifecycle: `ACTIVE` → `CONVERTED` / `EXPIRED` / `ABANDONED`.
- Mỗi customer có tối đa một cart `ACTIVE` (partial unique index SQL).
- Snapshot giá trên cart item chỉ để hiển thị; checkout phải refresh/validate lại từ catalog + inventory. Add-to-cart chỉ soft pre-check availability, chưa reserve.
- Optimistic locking qua `Cart.version`; mutation quan trọng hỗ trợ `idempotencyKey`.
- Catalog/Inventory gọi REST qua `CATALOG_SERVICE_URL` / `INVENTORY_SERVICE_URL` (timeout + retry), không import Prisma schema của service khác.
- Auth tạm: `x-user-id` (customer) và `x-cart-token` (guest) — không tin customerId từ body.

## ADR-026 — Order checkout orchestration + outbox (M7)

- **Quyết định:** `order-service` sở hữu DB `nexatech_order`. Tạo đơn chỉ từ authenticated cart: refresh + validate cart, re-price từ catalog, reserve inventory, persist order + packages + outbox trong local transaction, rồi convert cart. Không tin giá/SKU/totals/customerId từ body.
- Order code dạng `NT-YYYYMMDD-XXXXXX` (unique, không dùng raw UUID làm mã hiển thị).
- Money: integer VND; `discountTotal` luôn 0 (không voucher).
- State machine nghiêm ngặt; mọi transition ghi `OrderStatusHistory` + outbox event sau commit.
- Hủy: release reservation một lần (`inventoryReleased`); `refundContractStatus` chuẩn bị cho payment-service.
- Packages nhóm theo `(locationType, locationId)` từ kết quả reservation — không hard-code một kho.
- Sync REST tới cart/catalog/inventory; auth tạm `x-user-id` / `x-user-roles`.
- Compensation: nếu convert cart thất bại sau persist → release reservation + chuyển `FAILED`.

## ADR-007 — RBAC roles

- **Quyết định:** Roles: `Customer`, `Staff`, `Manager`, `Admin`, `SuperAdmin`.
- **Lý do:** Đủ cho storefront + admin portal; permission chi tiết map theo role trong `libs/shared/auth`.

## ADR-008 — Media trên MinIO

- **Quyết định:** `media-service` cấp presigned URL; object lưu MinIO.
- **Lý do:** Không đẩy binary qua NestJS body lớn; tách storage.

## ADR-009 — Payment adapters

- **Quyết định:** Interface `PaymentProvider`: `cod`, `mock`, `vnpay-sandbox`.
- **Lý do:** Thêm cổng mới không đụng core order flow. VNPay chỉ Sandbox cho tới khi có credential production.

## ADR-027 — Payment lifecycle + outbox + order sync (M8)

- **Quyết định:** `payment-service` sở hữu DB `nexatech_payment`. Tạo payment intent từ order thật qua `ORDER_SERVICE_URL` — không tin amount/customerId từ client. State machine: CREATED→PENDING→PROCESSING→PAID/FAILED/CANCELLED/EXPIRED + refund states. Money: Int VND; VNPay amount = VND × 100.
- COD: PENDING khi tạo; PAID khi thu tiền (giao hàng), chống double mark.
- MOCK: chỉ khi `MOCK_PAYMENT_ENABLED` (tắt mặc định ở production).
- VNPay: HMAC-SHA512, verify signature/amount/reference, callback idempotent + payloadHash chống replay; không log secret.
- Refund: domain full/partial + mock adapter; VNPay refund thật để sau khi có sandbox contract/credential.
- Order sync: REST `POST /orders/:id/payment-sync` (Staff+); local TX + outbox; `orderSyncedAt` chống cập nhật hai lần. Không tự huỷ order khi payment fail/expire.
- Auth tạm: `x-user-id` / `x-user-roles` (giống M4–M7).

## ADR-010 — Shipping adapters

- **Quyết định:** Interface `ShippingProvider` với **MOCK mặc định**; **GHN skeleton** (throw/`SHIPPING_PROVIDER_DISABLED` khi thiếu `GHN_TOKEN`/`GHN_SHOP_ID`/`GHN_BASE_URL` — không fake gọi API thật). Fallback phí rule-based `ORDER_SHIPPING_FEE_VND` khi provider unavailable.
- **Lý do:** Dev/test không phụ thuộc vendor; production chỉ bật GHN khi có credential người dùng.

## ADR-028 — Shipping lifecycle + quote/slot/outbox + order sync (M9)

- **Quyết định:** shipping-service sở hữu quote, delivery slot, shipment state machine, tracking, webhook; đồng bộ order qua `POST /orders/:id/shipping-sync`.
- Quote: lấy package thật từ order; phí từ Mock provider (deterministic) hoặc fallback `ORDER_SHIPPING_FEE_VND`; không tin fee client; TTL ~30 phút; Int VND.
- STANDARD/EXPRESS cần address; STORE_PICKUP cần storeId; không đồng thời address+pickup.
- Slot: capacity + optimistic version; idempotent reserve; release khi cancel.
- Shipment per package; chỉ transition hợp lệ; audit + outbox sau TX local.
- STORE_PICKUP: ready-for-pickup sinh mã (hash lưu, không log raw); confirm-pickup bắt buộc trước DELIVERED.
- Inventory: BOOKED chỉ khi package ALLOCATED/READY_TO_SHIP; PICKED_UP publish `inventory.stock.committed` / commit client một lần (`stockCommittedAt`).
- Webhook: verify HMAC/token (`SHIPPING_WEBHOOK_SECRET`); payloadHash chống replay.
- Order sync: `orderSyncedAt` chống double update; emit `shipment.delivered` (COD có thể consume).
- Auth tạm: `x-user-id` / `x-user-roles`; webhook không JWT.

## ADR-011 — Kong Gateway OSS

- **Quyết định:** Edge gateway duy nhất cho REST public; route theo service path.
- **Lý do:** CORS, JWT, rate-limit, upstream health tập trung.

## ADR-012 — Unified error envelope

```json
{
  "errorCode": "CATALOG_PRODUCT_NOT_FOUND",
  "message": "Không tìm thấy sản phẩm",
  "details": {},
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

- Mọi service dùng chung từ `libs/shared/errors`.
- Header `x-request-id` / `x-trace-id` xuyên suốt.

## ADR-013 — Không khuyến mãi / voucher / flash sale

- **Quyết định:** Loại khỏi domain model, API và UI.
- **Lý do:** Phạm vi sản phẩm bắt buộc.

## ADR-014 — Image tagging

- **Quyết định:** Tag theo semver/git sha (ví dụ `1.0.0`, `1.0.0-sha-abc123`). Không dùng `latest`.
- **Lý do:** Deploy tái lập được.

## ADR-015 — Testing stack

- **Quyết định:** Unit (Jest), integration (service + testcontainers/compose), API contract tests, Playwright E2E, k6 load/smoke.
- **Lý do:** Bao phủ từ logic tới production readiness.

## ADR-016 — Ngôn ngữ UI và message

- **Quyết định:** Storefront/admin và message nghiệp vụ mặc định tiếng Việt; mã `errorCode` tiếng Anh ổn định.
- **Lý do:** Sản phẩm hướng người dùng Việt Nam.

## ADR-017 — Version pin mục tiêu

| Thành phần | Version mục tiêu                                                                           |
| ---------- | ------------------------------------------------------------------------------------------ |
| Node.js    | 22 LTS (engines); runtime local 24.x chấp nhận được                                        |
| pnpm       | 10.x (`packageManager`: 10.34.5)                                                           |
| Nx         | **22.7.7** (không dùng 23.1.0 trên Windows hiện tại — lỗi native cache `WorkspaceContext`) |
| TypeScript | 5.8.3 (strict)                                                                             |
| Next.js    | 15.x (từ M15)                                                                              |
| NestJS     | 11.x (từ M3)                                                                               |
| Prisma     | 6.x                                                                                        |
| PostgreSQL | 16                                                                                         |
| Redis      | 7.x                                                                                        |
| RabbitMQ   | 3.13.x hoặc 4.x                                                                            |
| MinIO      | RELEASE gần nhất ổn định                                                                   |
| Kong       | 3.x OSS                                                                                    |
| Jest       | 29.7.x                                                                                     |
| ESLint     | 9.x flat config                                                                            |
| Prettier   | 3.6.x                                                                                      |

Phiên bản chính xác được khóa trong `package.json` / `pnpm-lock.yaml`.

## ADR-018 — Nx native file cache bypass trên Windows

- **Quyết định:** Đặt `NX_SKIP_NATIVE_FILE_CACHE=true` và `NX_DAEMON=false` trong scripts + `.env.nx`.
- **Lý do:** Nx 23.x lỗi `WorkspaceContext is not a constructor` khi load native binding từ temp; Nx 22.7.7 ổn định hơn nhưng vẫn cần bypass trên môi trường này.
- **Hệ quả:** Scripts dùng `cross-env` để set biến này trên mọi OS.
