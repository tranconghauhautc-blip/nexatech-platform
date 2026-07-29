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
- Ports mặc định: identity `3001`, customer `3002`, catalog `3003`, media `3004`, inventory `3005`.

## ADR-021 — Customer auth tạm bằng header

- **Quyết định tạm (M3):** `customer-service` nhận `x-user-id` / `x-user-name` header.
- **Lý do:** Chưa có JWT guard/gateway shared giữa service.
- **M4:** catalog admin và media dùng `x-user-id` + `x-user-roles` (comma-separated) tạm thời.
- **Mục tiêu sau:** Guard JWT + Kong; bỏ header giả lập trước production.

## ADR-022 — Prisma client output trong app

- **Quyết định:** `generator client { output = "../src/generated/prisma" }` per service.
- Env URL: `IDENTITY_DATABASE_URL`, `CUSTOMER_DATABASE_URL`, `CATALOG_DATABASE_URL`, `MEDIA_DATABASE_URL`, `INVENTORY_DATABASE_URL`.
- App DB users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media`, `nexatech_inventory` (không dùng role `postgres` cho app).
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

## ADR-007 — RBAC roles

- **Quyết định:** Roles: `Customer`, `Staff`, `Manager`, `Admin`, `SuperAdmin`.
- **Lý do:** Đủ cho storefront + admin portal; permission chi tiết map theo role trong `libs/shared/auth`.

## ADR-008 — Media trên MinIO

- **Quyết định:** `media-service` cấp presigned URL; object lưu MinIO.
- **Lý do:** Không đẩy binary qua NestJS body lớn; tách storage.

## ADR-009 — Payment adapters

- **Quyết định:** Interface `PaymentProvider`: `cod`, `mock`, `vnpay-sandbox`.
- **Lý do:** Thêm cổng mới không đụng core order flow. VNPay chỉ Sandbox cho tới khi có credential production.

## ADR-010 — Shipping adapters

- **Quyết định:** Interface `ShippingProvider` với mock carrier mặc định; adapter thật khi có API key.
- **Lý do:** Dev/test không phụ thuộc vendor bên ngoài.

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
