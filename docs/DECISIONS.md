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

## ADR-006 — Auth JWT + Redis session

- **Quyết định:** Access token JWT ngắn hạn; refresh token và session/device lưu Redis.
- **Lý do:** Thu hồi phiên theo thiết bị; OTP và rate-limit dùng chung Redis.

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

| Thành phần | Version mục tiêu |
|------------|------------------|
| Node.js | 22 LTS (engines); runtime local 24.x chấp nhận được |
| pnpm | 10.x |
| Nx | 21.x (latest compatible khi init) |
| TypeScript | 5.8.x |
| Next.js | 15.x |
| NestJS | 11.x |
| Prisma | 6.x |
| PostgreSQL | 16 |
| Redis | 7.x |
| RabbitMQ | 3.13.x hoặc 4.x |
| MinIO | RELEASE gần nhất ổn định |
| Kong | 3.x OSS |
| Zod | 3.x |
| Jest | 29.x / Nx default |

Phiên bản chính xác được khóa trong `package.json` / lockfile tại M1.
