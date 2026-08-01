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
- Ports mặc định: identity `3001`, customer `3002`, catalog `3003`, media `3004`, inventory `3005`, cart `3006`, order `3007`, payment `3008`, shipping `3009`, review `3010`, warranty `3011`, support `3012`, notification `3013`, reporting `3014`.

## ADR-021 — Customer auth tạm bằng header

- **Quyết định tạm (M3):** `customer-service` nhận `x-user-id` / `x-user-name` header.
- **Lý do:** Chưa có JWT guard/gateway shared giữa service.
- **M4:** catalog admin và media dùng `x-user-id` + `x-user-roles` (comma-separated) tạm thời.
- **Mục tiêu sau:** Guard JWT + Kong; bỏ header giả lập trước production.

## ADR-022 — Prisma client output trong app

- **Quyết định:** `generator client { output = "../src/generated/prisma" }` per service.
- Env URL: `IDENTITY_DATABASE_URL`, `CUSTOMER_DATABASE_URL`, `CATALOG_DATABASE_URL`, `MEDIA_DATABASE_URL`, `INVENTORY_DATABASE_URL`, `CART_DATABASE_URL`, `ORDER_DATABASE_URL`, `PAYMENT_DATABASE_URL`, `SHIPPING_DATABASE_URL`, `REVIEW_DATABASE_URL`, `WARRANTY_DATABASE_URL`, `SUPPORT_DATABASE_URL`, `NOTIFICATION_DATABASE_URL`, `REPORTING_DATABASE_URL`.
- App DB users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media`, `nexatech_inventory`, `nexatech_cart`, `nexatech_order`, `nexatech_payment`, `nexatech_shipping`, `nexatech_review`, `nexatech_warranty`, `nexatech_support`, `nexatech_notification`, `nexatech_reporting` (không dùng role `postgres` cho app).
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

## ADR-029 — Review verified buyer + moderation + aggregate (M10)

- **Quyết định:** `review-service` sở hữu DB `nexatech_review` (port `3010`). Chỉ verified buyer được tạo review: xác minh qua `ORDER_SERVICE_URL` — `order.customerId === actor`, `order.status === DELIVERED`, `orderItemId` thuộc order; nếu có package chứa item thì package cũng phải `DELIVERED`. Không tin customerId/ownership từ body.
- Một review active / `(customerId, orderItemId)` qua `activeKey`; soft-delete xoay `activeKey` → cho phép đánh giá lại sau khi xóa (có audit).
- State machine: `PENDING | PUBLISHED | HIDDEN | REJECTED | DELETED`. `REVIEW_AUTO_PUBLISH` mặc định `true` (dev/test) → tạo ra `PUBLISHED`; production có thể tắt để vào queue `PENDING`.
- Edit window: 72 giờ; optimistic `version`; soft-delete only.
- Media: chỉ reference `mediaId` từ media-service; tối đa 5 ảnh + 1 video; verify ownership + MIME; unlink local khi xóa (không xóa object MinIO trực tiếp).
- Store reply: Staff+; một reply active / review; chỉ trên `PUBLISHED`.
- Helpful: một vote / (reviewId, customerId); cấm self-vote; idempotent.
- Report: unique active theo `(reviewId, reporterId, reason)`; statuses OPEN/REVIEWING/RESOLVED/DISMISSED.
- Aggregate: chỉ đếm `PUBLISHED`; integer math `averageRatingCents = round(sumRating * 100 / total)`; rebuild admin endpoint.
- Privacy: mask displayName; public DTO không trả customerId/email/phone; sanitize content.
- Outbox + RabbitMQ sau local TX; clients REST tới order/catalog/media với timeout/retry.
- Auth tạm: `x-user-id` / `x-user-roles`.

## ADR-030 — Warranty claim + return + order sync (M11)

- **Quyết định:** `warranty-service` sở hữu DB `nexatech_warranty` (port `3011`). Hai domain riêng: **WarrantyClaim** và **ReturnRequest**, mỗi loại có state machine riêng.
- Verified purchase: `ORDER_SERVICE_URL` — ownership từ header, `order.status === DELIVERED`, `orderItemId` thuộc order; package chứa item (nếu có) cũng `DELIVERED`. SKU/productId lấy từ order item snapshot — **không** tin body.
- Một claim active và một return active / `(customerId, orderItemId)` qua `activeKey`; terminal state rotate key.
- Claim: `SUBMITTED → UNDER_REVIEW → APPROVED → IN_PROGRESS → COMPLETED` (+ REJECTED/CANCELLED). Return: `REQUESTED → UNDER_REVIEW → APPROVED → AWAITING_RETURN → RECEIVED → COMPLETED` (+ REJECTED/CANCELLED).
- Evidence: chỉ reference `mediaId`; tối đa 5 ảnh; verify ownership + MIME `image/*` qua media-service; không nhận file raw; không truy cập DB media.
- Optimistic `version` + idempotency key + AuditLog.
- Order sync REST `POST /orders/:id/return-sync` (Staff+): APPROVED → `RETURN_REQUESTED`; COMPLETED → `RETURNED`; REJECTED/CANCELLED sau khi đã sync RETURN_REQUESTED → `DELIVERED`. Idempotent (đã đúng status thì no-op); retry HTTP giới hạn; `x-trace-id`; không distributed TX; warranty ghi `orderSyncedStatus`/`orderSyncedAt`.
- Sync gọi bằng service actor Staff (`WARRANTY_SERVICE_ACTOR_ID`), không phụ thuộc role customer.
- **Không** gọi payment refund / inventory return HTTP trong M11 — chỉ publish `warranty.refund_requested` / `warranty.inventory_return_requested` để milestone sau consume.
- Outbox + RabbitMQ; auth tạm `x-user-id` / `x-user-roles`.

## ADR-031 — Support ticket + staff queue (M12)

- **Quyết định:** `support-service` sở hữu DB `nexatech_support` (port `3012`). Domain **SupportTicket** + messages + attachments + history.
- State machine: `OPEN → IN_PROGRESS → WAITING_CUSTOMER|RESOLVED|CLOSED`, `WAITING_CUSTOMER` (customer message → `WAITING_STAFF`), `WAITING_STAFF → IN_PROGRESS|RESOLVED|CLOSED`, `RESOLVED → CLOSED|reopen→IN_PROGRESS`; terminal `CLOSED`/`CANCELLED`.
- Category: ORDER/PRODUCT/PAYMENT/SHIPPING/WARRANTY/ACCOUNT/OTHER; priority LOW/NORMAL/HIGH/URGENT (staff đổi được).
- Liên kết tùy chọn `orderId` / `warrantyClaimId` / `returnRequestId` — chỉ lưu REST ID, không share DB. Nếu có `orderId`: soft-validate ownership qua `ORDER_SERVICE_URL` (không bắt buộc DELIVERED).
- Attachment: reference `mediaId` (max 5 ảnh), verify ownership + MIME `image/*` qua media-service.
- Optimistic `version` + idempotency key + AuditLog; ticket code `NT-S-YYYYMMDD-XXXXXX`.
- Outbox + RabbitMQ sau local TX; auth tạm `x-user-id` / `x-user-roles`.
- Staff+ (Staff/Manager/Admin/SuperAdmin) xử lý queue/transition/assign/priority/reply.

## ADR-032 — Notification email + in-app + inbox consumer (M13)

- **Quyết định:** `notification-service` sở hữu DB `nexatech_notification` (port `3013`).
- Channels: **IN_APP** (REST list/read/delete) và **EMAIL** (SMTP adapter qua `SMTP_*` env; LoggingEmailSender khi thiếu SMTP ở local).
- **Consumer RabbitMQ đầu tiên** trong monorepo: queue durable `notification-service.events`, bind topic `nexatech.events`, DLX `nexatech.events.dlx`, prefetch từ `NOTIFICATION_CONSUMER_PREFETCH`.
- Idempotency inbox: bảng `ProcessedEvent` keyed bởi `eventId` — xử lý lại cùng event là no-op.
- Template tiếng Việt theo `templateKey`/`eventType` (identity/order/payment/shipping/review/warranty/support + `notification.requested`).
- Recipient: `customerId|userId|assigneeId` + `email|customerEmail|toEmail`; support message STAFF→customer, CUSTOMER→assignee; assign→assignee.
- REST idempotency (`NotificationIdempotency`) + AuditLog; auth tạm `x-user-id` / `x-user-roles`.
- Không distributed TX; không gọi DB service khác; không hard-code SMTP secret.

## ADR-033 — Reporting dashboard + audit projection (M14)

- **Quyết định:** `reporting-service` sở hữu DB `nexatech_reporting` (port `3014`). Read model duy nhất tổng hợp từ sự kiện domain khác — **không** ghi vào DB service khác, **không** gọi REST sync ngược.
- Consumer RabbitMQ thứ hai trong monorepo (sau notification): queue durable `reporting-service.events`, bind topic `nexatech.events`, DLX `nexatech.events.dlx`, prefetch từ `REPORTING_CONSUMER_PREFETCH`.
- Idempotency inbox: `ProcessedEvent` keyed bởi `eventId` (kiểm tra `isProcessed` trước khi ghi projection, `tryMarkProcessed` sau khi ghi thành công — cùng pattern notification-service).
- Projection tables (upsert theo id trích từ payload, tên field linh hoạt: `orderId`/`paymentId`/`shipmentId`/`reviewId`/`claimId`/`returnId`/`ticketId`): `OrderProjection`, `PaymentProjection`, `ShipmentProjection`, `ReviewProjection`, `WarrantyClaimProjection`, `WarrantyReturnProjection`, `SupportTicketProjection`. Field nào không có trong payload thì giữ nguyên giá trị cũ (không ghi đè bằng `undefined`); lần đầu tạo lấy `createdAt` từ `occurredAt` của event.
- `DailyMetric` đếm theo `(metricDate, domain, metricKey)` — tăng nguyên tử qua upsert+increment; `revenue_vnd` cộng dồn từ `amount`/`paidAmount`/`grandTotal` khi `payment.paid`/`payment.succeeded`.
- `AuditLogProjection` lưu sự kiện `audit.recorded` (từ các service khác, vd. media-service) và audit ghi thủ công qua `POST /admin/reporting/audit` (Staff+, hỗ trợ `idempotency-key`, đồng thời ghi `AuditLog` nội bộ).
- REST `GET /admin/reporting/dashboard|metrics/daily|orders|payments|shipments|reviews|warranty/claims|warranty/returns|support/tickets|audit-logs` — RBAC Staff+ toàn bộ (Staff/Manager/Admin/SuperAdmin).
- Auth tạm: `x-user-id` / `x-user-roles`; không distributed TX; không hard-code credential.

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

## ADR-034 — Frontend BFF + session cookie (M15)

- **Quyết định:** `storefront-web` (port 3000) và `admin-web` (port 3100) dùng Next.js 15 App Router. Browser gọi relative `/api/bff/{service}/...` và `/api/auth/...`; server proxy tới `*_SERVICE_URL` (fallback localhost ports). Không hard-code IP production.
- Session storefront: httpOnly cookie JSON `nt_session` + `nt_cart_token`. Admin: cookie ký HMAC `nexatech_admin_session` (cần `ADMIN_SESSION_SECRET` hoặc `JWT_ACCESS_SECRET`).
- Token không lưu localStorage. Admin login từ chối role Customer (`canAccessAdminPortal`).
- Menu admin chỉ là UX filter; backend RBAC vẫn là nguồn quyền.
- Shared FE helpers trong `libs/shared/web`.
- Dockerfile multi-stage `output: 'standalone'`, non-root, healthcheck.
- **Nx sync:** tắt `@nx/js:typescript-sync` trong `nx.json` (`sync.disabledTaskSyncGenerators`) để tránh ép `references`/`composite` trên Nest apps (gây TS6305 khi `dist/out-tsc` chưa có). Path alias trong `tsconfig.base.json` vẫn là nguồn resolve.

## ADR-035 — Docker backends + Kong + E2E (M16)

- **Quyết định:** Mỗi Nest service có Dockerfile multi-stage riêng (Node 22 bookworm, non-root, `/health/live` healthcheck, tag semver `0.16.0`). Compose apps tại `infra/docker/docker-compose.apps.yml` + Kong declarative `infra/kong/kong.yml` route `/api/v1` / `/api/v2`.
- Prisma `binaryTargets` gồm `native` + `debian-openssl-3.0.x`; runtime copy `schema.prisma` + query engine cạnh `main.js`.
- Identity/customer: wire Prisma repository khi có `*_DATABASE_URL` (InMemory chỉ `NODE_ENV=test`); migration `20260730160000_init_*`.
- Catalog seed ~100 SP: `pnpm seed:catalog` (`scripts/seed-catalog.cjs`).
- Playwright E2E smoke: `e2e/` + `pnpm e2e` (tự `nx dev` storefront/admin nếu chưa có URL override).
- BFF hardening: whitelist service + `sanitizeBffPathParts`, timeout `BFF_UPSTREAM_TIMEOUT_MS`, không lộ URL nội bộ trong lỗi 502.
- Next.js giữ **15.2.4** (không nâng CVE patch trong M16).

## ADR-036 — Helm chart + MetalLB entry + Kong VIP + migrate Jobs (M17)

- **Quyết định:** Đóng gói production qua Helm chart `deploy/helm/nexatech` **version 0.17.0** (appVersion `0.17.0`). PostgreSQL nằm ngoài cluster (VM `192.168.4.208`) — host chỉ khai báo trong `values-production.yaml`, không hard-code trong source app. MetalLB cấp VIP **`192.168.4.204`** cho Service `entry` (nginx reverse-proxy + `LoadBalancer`); mọi Deployment app/platform khác dùng **ClusterIP**. Kong production (VM `192.168.4.209`) upstream **chỉ** tới VIP; config declarative `infra/kong/kong.production.yml`. Kong local `infra/kong/kong.yml` giữ route `/` (storefront) và `/admin` (admin-web) cùng `/api/v1`/`/api/v2`.
- **Migrate:** Mỗi backend Prisma có image riêng tag `${IMAGE_TAG}-migrate`, build từ `deploy/docker/prisma-migrate.Dockerfile`; Helm Job hook `pre-install,pre-upgrade` (`migrations-job.yaml`), `backoffLimit: 1`, `prisma migrate deploy` only — xem `docs/MIGRATIONS.md`.
- **Build:** Scripts `scripts/docker-build-all.ps1` và `scripts/docker-build-all.sh` build/push tất cả hoặc một image; **không** gọi `docker login` (operator login thủ công trước khi `-Push`). Tag mặc định `0.17.0` hoặc git SHA (`-UseGitSha` / `--use-git-sha`).
- **Runtime:** Container Nest/Next chạy non-root **UID 10001**; `app.enableShutdownHooks()` trên mọi Nest service (graceful shutdown khi pod terminate). Frontend/backend Dockerfiles multi-stage giữ pattern M16, bump tag `0.17.0`.
- **Secrets:** Không commit secret thật; mẫu `deploy/helm/nexatech/secret-values.example.yaml` + `values-production.yaml` dùng placeholder `CHANGE_ME_*`. Secret K8s tạo thủ công / Sealed Secrets / External Secrets trước `helm upgrade`.
- **Platform in-cluster:** Redis, RabbitMQ, MinIO (+ bucket-init Job) deploy qua chart, **ClusterIP only** — không LoadBalancer/Ingress public cho management/console.
- **Agent boundary (BLOCKED_EXTERNAL):** Agent không chạy `kubectl apply`, `helm upgrade --install` lên cluster thật khi chưa xác minh kube-context và phê duyệt operator. Validation unattended giới hạn: `helm lint`, `helm template`, Docker build/smoke local, `kubectl apply --dry-run=client` nếu có kubeconfig — không mutate production.
- **Lý do:** Tách packaging K8s khỏi business logic M0–M16; một VIP ổn định cho Kong VM; migrate an toàn qua hook Job; giữ secret và deploy thật ngoài git/CI unattended.
- **Hệ quả:** M18 tập trung observability, backup/runbook, security baseline và deploy thật lên infra `.208/.209/.205–.207/.204`. OWASP 20 scenarios vẫn sau M18 (M21 roadmap).

## ADR-037 — Observability stack + log redaction (M18)

- **Quyết định:** Observability tách chart `deploy/helm/nexatech-observability` **0.18.0**: Prometheus, Grafana, Loki, Promtail, Tempo, OpenTelemetry Collector. Tất cả Service **ClusterIP** (Grafana/management không public). Resource requests/limits thấp cho cluster 3 node.
- App chart annotate Prometheus scrape (`/health/live` path sẵn; `/metrics` có thể bổ sung sau). Env OTEL (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`) inject khi `config.otel.enabled` — **không** hard-code host production trong source.
- Structured logging (`@nexatech/shared-logging`): redaction tự động password/token/OTP/signature; `LOG_LEVEL` configurable.
- **Không** thêm OpenTelemetry SDK npm lớn trong M18 (tránh nâng dependency lớn); collector + env sẵn sàng để gắn SDK sau.
- NetworkPolicy production: `networkPolicy.enabled: true` trong `values-production.yaml` (default-deny + allow entry/intra-namespace).
- Ops: `docs/BACKUP-RESTORE.md`, `docs/K8S-OPS.md`, `docs/DEPLOY-RUNBOOK-PRODUCTION.md`, `docs/SECURITY-BASELINE.md`; scripts validate/backup/seed-production/secret-leak.
- **Cấm:** intentional OWASP vulnerabilities; restore vào DB prod từ agent unattended; `helm upgrade`/`kubectl apply` thật khi kube-context chưa verified.

## ADR-038 — Deployment preflight và release readiness (M19)

- **Quyết định:** Chuẩn hóa release readiness trước deploy thật bằng scripts read-only + tài liệu matrix/order/checklist. Scripts: `scripts/deploy-preflight.ps1|.sh` (kube-context, nodes, StorageClass, MetalLB, Secrets/ConfigMaps names, image tag policy, Helm lint/template apps+obs, Kong static VIP mapping, TCP Postgres khi reachable) và `scripts/smoke-release.ps1|.sh` (private/local target guard, health/catalog smoke, optional mutate). Machine-readable `docs/image-matrix.json` + `docs/IMAGE-MATRIX.md`. Deployment order `docs/DEPLOYMENT-ORDER.md`. Release gate `docs/RELEASE-CHECKLIST.md`. Migration orchestration bổ sung trong `docs/MIGRATIONS.md` (deploy-only, failure blocks rollout, retry/cleanup/rollback).
- **Cấm:** mutate cluster/Kong từ preflight; in secret values; dùng tag `latest`; seed production trong unattended mode; `prisma migrate reset` / `db push`.
- **Exit codes:** `0` = OK hoặc OK+BLOCKED (offline-friendly); `1` = FAIL; `-Strict`/`--strict` nâng BLOCKED → FAIL.
- **Lý do:** Tách packaging (M17) và observability (M18) khỏi bước “sẵn sàng release” có kiểm tra lặp lại được trước khi operator chạy Helm/Kong thật.
- **Hệ quả:** M20 tập trung k6/performance, resilience, DR validation, SLI/SLO; M21 OWASP security lab sau khi M19–M20 xanh.

## ADR-039 — Performance, resilience và DR readiness (M20)

- **Quyết định:** Thêm bộ k6 lab scenarios (`tests/k6/`) với private target guard, lab thresholds (không hard-code SLO production thiếu căn cứ), resilience failure-mode catalog (`docs/RESILIENCE-TESTING.md`), SLI/SLO draft (`docs/SLO-SLI.md`), DR RPO/RTO draft (`docs/DISASTER-RECOVERY.md`), incident runbook (`docs/INCIDENT-RESPONSE.md`), Prometheus alert rule drafts (`deploy/observability/alerts/nexatech-alerts.yaml`), và dry-run scripts (`k6-validate`, `resilience-dry-run`, `backup-restore-validate`, `validate-alerts`).
- **Cấm:** chaos/pod-kill trên cluster thật unattended; restore vào DB production; k6 nhắm Internet công cộng mặc định; log secret/token trong k6.
- **Lý do:** Đo hiệu năng và sẵn sàng vận hành trước security lab (M21).
- **Hệ quả:** M21 xây security-lab profile tách biệt production với intentional vulnerabilities có kiểm soát.

## ADR-040 — Security lab intentional vulnerabilities (M21)

- **Quyết định (lịch sử M21):** Hai deploy profile Helm (production vs `nexatech-security-lab`) cho isolation namespace/image/NetworkPolicy.
- **Superseded bởi ADR-044:** Dual-gate `isSecurityLabEnabled` (đòi hỏi cả hai env) và secure policy branch **đã bị gỡ**. Intentional vulns **ALWAYS ON** trong `@nexatech/shared-security-lab` cho WAF PoC; Helm flags chỉ còn isolation marker.
- **Vulnerabilities:** xem `docs/OWASP-SCENARIOS.md` (SC-01… + SC-70…SC-95).
- **Tests:** `pnpm security:test:secure|lab` đều assert hành vi vulnerable; runners HTTP cần `SECURITY_LAB_ACK=YES` + private target guard.
- **Cấm:** secret thật; PoC Internet công cộng không kiểm soát.
- **Hệ quả:** Roadmap M0–M21 hoàn tất; PoC appliance theo ADR-044.

## ADR-041 — Nest production Docker runtime dependencies

- **Vấn đề:** Sau M0–M21, Compose local (`docker-compose.apps.yml`) khiến 14 Nest backends `Exited (1)` với `Cannot find module '@nestjs/common'` (và sau patch install: `tslib`).
- **Nguyên nhân gốc:**
  1. Nx webpack `generatePackageJson: true` **externalize** runtime deps vào `dist/apps/<service>/package.json` + pruned `pnpm-lock.yaml`, nhưng Dockerfile chỉ `COPY` bundle và chạy `node main.js` — **không** materialize production `node_modules`.
  2. `tslib` nằm trong root `devDependencies` trong khi `tsconfig` `importHelpers: true` emit `require('tslib')` vào `main.js`; Nx omit `tslib` khỏi generated production package.json → thiếu module dù đã `pnpm install --prod`.
  3. `nx prune` / `@nx/js:prune-lockfile` không dùng được trong integrated monorepo (không có `apps/*/package.json`); generator không cần prune target.
- **Quyết định:**
  - Chuyển `tslib` sang root `dependencies`.
  - Cập nhật `scripts/m16-gen-dockerfiles.mjs` và regenerate 14 Dockerfiles: sau `nx build`, chạy `pnpm install --prod --frozen-lockfile --ignore-workspace` trong `dist/apps/<service>` (dùng package.json + lockfile do Nx sinh; không copy workspace `node_modules`, không `npm install`).
  - Health controllers dùng `@Controller({ version: VERSION_NEUTRAL })` để `/health/live` khớp Docker/Helm probes (trước đó URI versioning đẩy probe sang `/v1/health/live`).
  - Frontend runner: `HOSTNAME=0.0.0.0` để Next standalone lắng nghe loopback cho healthcheck trong container.
- **Không đổi:** UID 10001, Prisma engine copy, image tags `0.17.0`, security-lab build args, migrate Dockerfile, Nx 22.7.7, Node 22.
- **Hệ quả:** Local Compose stack: 14 Nest + storefront + admin + Kong healthy; smoke `/health/live` OK.

## ADR-042 — DEV account seed + OWASP API/Web coverage completion

- **Quyết định:** Thay `seed:identity` (hard-coded `Secret123`) bằng `pnpm seed:accounts`:
  - Chỉ chạy khi `NODE_ENV≠production` + `NEXATECH_ALLOW_DEV_SEED=YES` + `DEV_SEED_PASSWORD` (policy ≥12, upper/lower/digit/special).
  - bcryptjs cost 10 (khớp identity-service); không in plaintext; không auto-reset password trừ `DEV_SEED_RESET_PASSWORD=YES`.
  - 4 account `@nexatech.local` (Staff/Manager/Admin/SuperAdmin); marker `User.isDevSeed`; không seed Customer.
- **OWASP:** Mở rộng security lab lên 30 intentional scenarios với ma trận riêng API Top 10:2023 và Web Top 10:2025 trong `docs/OWASP-SCENARIOS.md`. Bổ sung policy helpers SSRF, deprecated inventory, upstream trust, supply-chain fixture, ORDER BY injection, audit suppress, error leakage, weak secret compare, debug exposure, business-flow quota.
- **Cấm:** hard-code password; bật lab qua HTTP; PoC ra Internet; malware package download cho A03.
- **Hệ quả:** Local login/RBAC smoke dùng password do operator đặt; coverage API1–API10 và A01–A10 có evidence automated.

## ADR-043 — Local security training lab (browser + Swagger + OpenAPI 3)

- **Quyết định:** Bổ sung lớp “local security training lab” trên nền M21, không mở milestone roadmap mới:
  - Tài liệu entry points: `docs/LOCAL-LAB-LINKS.md`, `docs/SWAGGER-LINKS.md`, `docs/LOCAL-SECURITY-LAB-GUIDE.md`, `docs/OPENAPI-GUIDE.md`.
  - Shared Swagger bootstrap `setupNexaTechSwagger` trong `@nexatech/shared-platform` (servers same-origin `/` + local + Kong trên live UI; production placeholder chỉ trong exported OpenAPI; Bearer + gateway headers, ErrorEnvelope, deterministic `operationIdFactory`; strip browser-forbidden header params).
  - OpenAPI tooling: `pnpm openapi:generate|combine|validate` → `openapi/*.openapi.yaml` + `nexatech-combined.openapi.yaml` (import Burp/ZAP/Postman).
  - Identity: DTOs/Swagger examples, `GET /api/v1/auth/me` cho Authorize flow; seed accounts giữ gate `DEV_SEED_PASSWORD`.
  - Admin: `/unauthorized`, `/forbidden`, RBAC route guard theo menu `minimumRole`, `/security-lab` dashboard luôn mở (xem ADR-044).
  - HTTP smoke `pnpm lab:smoke`; Playwright `e2e/admin/rbac-roles.spec.ts` (cần `E2E_DEV_SEED_PASSWORD`).
- **Cấm:** hard-code password; secret trong OpenAPI.
- **Hệ quả:** Người học mở browser login/logout, Swagger call API, import OpenAPI 3; coverage OWASP API1–10 / A01–A10 giữ qua ADR-042.

## ADR-044 — Always-on intentional vulnerabilities (WAF / API Security PoC)

- **Quyết định:** Bỏ toàn bộ dual-gate / `FORCE_SECURE` / secure policy branch. `@nexatech/shared-security-lab` **luôn** trả về hành vi vulnerable; `isSecurityLabEnabled()` luôn `true`.
- **Mục đích:** Chứng minh WAF và API Security appliance phát hiện/chặn tấn công trên ứng dụng sống (mọi môi trường: local Compose, K8s, …).
- **HTTP executable:** BOLA/BFLA/mass-assignment (admin users create/disable/export), SSRF `/lab/ssrf-probe`, SQLi ORDER BY, XSS `/tim-kiem?q=`, open redirect, JWT `alg=none` + query token, CSRF Origin skip, debug leak, host-header reset poison, GET login, verify-bypass, SC-70…SC-95 lab probes, v.v.
- **Public guides (không auth):** `http://localhost:3000/lab/owasp-api-top10.html`, `http://localhost:3000/lab/owasp-web-top10.html`.
- **Cấm:** thêm lại toggle tắt lỗ hổng cho runtime PoC; coi đây là production hardening mặc định.
- **Hệ quả:** ADR-040 dual-profile lab gate bị thay thế cho mục tiêu appliance PoC.

## ADR-045 — Combined Swagger portal (local/lab)

- **Quyết định:** Thêm `apps/swagger-portal` phục vụ `openapi/nexatech-combined.openapi.yaml` tại:
  - Direct: `http://localhost:8090/docs`
  - Kong local: `http://localhost:8000/docs` (+ `/openapi/*` download)
- Tags gộp theo service display name (Identity…Reporting).
- Gate: `NEXATECH_SWAGGER_PORTAL_ENABLED=1` / security-lab / development; production default **off**; **không** thêm vào `kong.production.yml`.
- Per-service `/docs` giữ nguyên để debug.
- Health smoke: `pnpm lab:smoke` kiểm portal + Kong `/docs`.
- **Cấm:** public combined Swagger trên production edge; làm yếu cookie/BFF auth vì Swagger Bearer lab.
