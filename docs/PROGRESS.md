# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(sẵn sàng M16 — chưa bắt đầu)_
- **Milestone đã hoàn thành gần nhất:** M15 (storefront-web + admin-web)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra DoD M15:** format / lint / test / build OK

## Roadmap milestone

| ID      | Milestone                                 | Trạng thái | Ghi chú                          |
| ------- | ----------------------------------------- | ---------- | -------------------------------- |
| M0      | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done    | Docs + env check                 |
| M1      | Khởi tạo Nx monorepo                      | ✅ Done    | Nx **22.7.7** + TS strict + Jest |
| M2      | Shared libraries và chuẩn nền tảng        | ✅ Done    | 7 shared libs                    |
| M3      | Identity và customer                      | ✅ Done    | Auth flows + customer profile    |
| M4      | Catalog, search và media                  | ✅ Done    | Prisma + FTS + MinIO             |
| M5      | Inventory                                 | ✅ Done    | warehouse/store/stock + RabbitMQ |
| M6      | Cart                                      | ✅ Done    | guest/user merge + Redis         |
| M7      | Order / Checkout                          | ✅ Done    | order-service + outbox           |
| M8      | Payment                                   | ✅ Done    | payment-service + VNPay/MOCK/COD |
| M9      | Shipping                                  | ✅ Done    | shipping-service + mock/GHN      |
| M10     | Review                                    | ✅ Done    | review-service                   |
| M11     | Warranty                                  | ✅ Done    | warranty-service                 |
| M12     | Support                                   | ✅ Done    | support-service                  |
| M13     | Notification                              | ✅ Done    | notification-service             |
| M14     | Reporting                                 | ✅ Done    | reporting-service                |
| M15     | Frontend storefront + admin               | ✅ Done    | Next.js 15 App Router            |
| M16–M22 | …                                         | ⏳ Pending | Sau DoD M15                      |

## Commits

| Commit      | Nội dung                 |
| ----------- | ------------------------ |
| `8526147`   | M4 catalog + media       |
| `b38b723`   | M5 inventory-service     |
| `d2155fc`   | M6 cart-service          |
| `4e2627a`   | M7 order-service         |
| `1245aff`   | M8 payment-service       |
| `882320f`   | M9 shipping-service      |
| `7c203c6`   | M9 docs hash             |
| `631cd88`   | M10 review-service       |
| `d7d4905`   | M10 docs hash            |
| `a60e754`   | M11 warranty-service     |
| `c5a1627`   | M11 docs hash            |
| `7c1a582`   | M12 support-service      |
| `194cdec`   | M12 docs hash            |
| `b353d67`   | M13 notification-service |
| `5c365a3`   | M13 docs hash            |
| `8f86457`   | M14 reporting-service    |
| `b65e901`   | M14 docs hash            |
| `2105088`   | M15 storefront + admin   |

## Apps sau M15 (24 projects)

| App                  | Port | Persistence                       |
| -------------------- | ---- | --------------------------------- |
| storefront-web       | 3000 | Next.js BFF + httpOnly session    |
| admin-web            | 3100 | Next.js BFF + signed admin cookie |
| identity-service     | 3001 | In-memory (schema sẵn)            |
| customer-service     | 3002 | In-memory (schema sẵn)            |
| catalog-service      | 3003 | Prisma + Postgres FTS             |
| media-service        | 3004 | Prisma + MinIO                    |
| inventory-service    | 3005 | Prisma + optimistic lock          |
| cart-service         | 3006 | Prisma + Redis assist + RabbitMQ  |
| order-service        | 3007 | Prisma + outbox + RabbitMQ        |
| payment-service      | 3008 | Prisma + outbox + RabbitMQ        |
| shipping-service     | 3009 | Prisma + outbox + RabbitMQ        |
| review-service       | 3010 | Prisma + outbox + RabbitMQ        |
| warranty-service     | 3011 | Prisma + outbox + RabbitMQ        |
| support-service      | 3012 | Prisma + outbox + RabbitMQ        |
| notification-service | 3013 | Prisma + inbox consumer + SMTP    |
| reporting-service    | 3014 | Prisma + inbox consumer + metrics |

## M15 đã hoàn thành

- [x] `libs/shared/web` — format VND/date, ApiClient, admin menu RBAC helpers
- [x] `storefront-web` — layout, home, danh mục, tìm kiếm, PDP, giỏ, checkout, auth UI, tài khoản
- [x] SEO storefront (metadata/OG/sitemap/robots + Product/Breadcrumb JSON-LD)
- [x] `admin-web` — login Staff+, RBAC menu, dashboard + list modules, users stub
- [x] BFF `/api/bff/{service}` + auth routes; session httpOnly; không localStorage token
- [x] Dockerfile multi-stage storefront + admin; compose notes; env `.env.example`
- [x] Unit/component tests (storefront 28, admin 3, shared-web 8)
- [x] ADR-034; docs ARCHITECTURE/API/TESTING/DECISIONS; `docs/HANDOFF-M16.md`
- [x] format / lint / test / build monorepo
- [x] **Không bắt đầu M16**

## M14 đã hoàn thành

- [x] Shared contracts / errors cho reporting
- [x] reporting-service Prisma + migration `nexatech_reporting` (`20260730140000_init_reporting`)
- [x] Projection tables (order/payment/shipment/review/warranty/support) + DailyMetric + AuditLogProjection
- [x] RabbitMQ consumer + ProcessedEvent inbox idempotency + DLX (nack requeue=false)
- [x] Staff+ REST dashboard / metrics / lists / audit
- [x] Unit + controller + handlers + migration + Prisma integration + consumer (56/56 pass)
- [x] Docker DB init (`nexatech_reporting`) + docs + HANDOFF-M15
- [x] format / lint / test / build (chạy cuối M14)

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
M15: `sync.disabledTaskSyncGenerators: ["@nx/js:typescript-sync"]` (tránh ép TS project references trên Nest).

## Local note (Postgres volume đã init)

Nếu DB `nexatech_reporting` chưa có (volume cũ):

```sql
CREATE USER nexatech_reporting WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_reporting OWNER nexatech_reporting;
```

Rồi trong DB đó: `GRANT ALL ON SCHEMA public TO nexatech_reporting;`

Rồi: `cd apps/reporting-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M15 done

- storefront-web (3000) + admin-web (3100) + shared-web; Next.js **15.2.4**; ADR-034 BFF/session.
- UI tiếng Việt, VND; không voucher/flash sale; admin `robots` disallow.
- Test FE: storefront 28, admin 3, shared-web 8; lint 0 errors; build monorepo xanh (24 projects).
- Commit `2105088`.
- HANDOFF-M16 sẵn sàng; **không bắt đầu M16**.

### 2026-07-30 — M15 start

- Working tree sạch; HEAD `b65e901` (docs M14 hash; feat M14 `8f86457`); branch `main`.
- Phạm vi M15 từ HANDOFF: `storefront-web` + `admin-web` (Next.js 15 App Router), tích hợp REST `/api/v1` qua env URL, UI tiếng Việt, VND, RBAC admin.
- Backend hiện có (14): identity, customer, catalog, media, inventory, cart, order, payment, shipping, review, warranty, support, notification, reporting.
- Baseline format/lint/test/build xanh (21 projects) trước khi code FE.
- Không bắt đầu M16 trong phiên này.

### 2026-07-30 — M14 done

- reporting-service hoàn chỉnh: dashboard metrics + audit projection, RabbitMQ consumer/inbox, DailyMetric atomic increment, Staff+ REST.
- Shared contracts/errors + ADR-033; Docker DB init; docs + HANDOFF-M15.
- Test reporting 56/56 (integration Postgres Compose); format/lint/test/build monorepo xanh (21 projects).
- Commit `8f86457`.
- **Không bắt đầu M15 trong phiên này**.
