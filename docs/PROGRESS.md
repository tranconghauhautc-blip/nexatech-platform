# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M15 — chưa bắt đầu
- **Milestone đã hoàn thành gần nhất:** M14 (reporting-service)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — xanh (21 projects; reporting 56/56 incl. Prisma integration Postgres Compose)

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
| M15–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M15.md`        |

## Commits

| Commit    | Nội dung                 |
| --------- | ------------------------ |
| `8526147` | M4 catalog + media       |
| `b38b723` | M5 inventory-service     |
| `d2155fc` | M6 cart-service          |
| `4e2627a` | M7 order-service         |
| `1245aff` | M8 payment-service       |
| `882320f` | M9 shipping-service      |
| `7c203c6` | M9 docs hash             |
| `631cd88` | M10 review-service       |
| `d7d4905` | M10 docs hash            |
| `a60e754` | M11 warranty-service     |
| `c5a1627` | M11 docs hash            |
| `7c1a582` | M12 support-service      |
| `194cdec` | M12 docs hash            |
| `b353d67` | M13 notification-service |
| `5c365a3` | M13 docs hash            |
| `8f86457` | M14 reporting-service    |

## Apps sau M14 (21 projects)

| App                  | Port | Persistence                       |
| -------------------- | ---- | --------------------------------- |
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

## M14 đã hoàn thành

- [x] Shared contracts / errors cho reporting
- [x] reporting-service Prisma + migration `nexatech_reporting` (`20260730140000_init_reporting`)
- [x] Projection tables (order/payment/shipment/review/warranty/support) + DailyMetric + AuditLogProjection
- [x] RabbitMQ consumer + ProcessedEvent inbox idempotency + DLX (nack requeue=false)
- [x] Staff+ REST dashboard / metrics / lists / audit
- [x] Unit + controller + handlers + migration + Prisma integration + consumer (56/56 pass)
- [x] Docker DB init (`nexatech_reporting`) + docs + HANDOFF-M15
- [x] format / lint / test / build (chạy cuối M14)

## M13 đã hoàn thành

- [x] Shared contracts / errors cho notification
- [x] notification-service Prisma + migration `nexatech_notification` (`20260730130000_init_notification`)
- [x] In-app REST (list/unread/read/read-all/delete) + ownership
- [x] Email delivery + Vietnamese templates + SMTP env adapter
- [x] RabbitMQ consumer + ProcessedEvent inbox idempotency + DLX
- [x] Staff+ request notification + admin email deliveries
- [x] Support outbox payload enrichment (`customerId`/`assigneeId`) — additive
- [x] Unit + controller + migration + Prisma integration (61/61 pass)
- [x] Docker DB init (`nexatech_notification`) + docs + HANDOFF-M14
- [x] format / lint / test / build (chạy cuối M13)

## M12 đã hoàn thành

- [x] Shared contracts / errors / events cho support ticket
- [x] support-service Prisma + migration `nexatech_support` (`20260730120000_init_support`)
- [x] Ticket state machine + customer/staff messages (WAITING_CUSTOMER → WAITING_STAFF)
- [x] Optional order ownership check; warranty/return opaque REST IDs
- [x] Media attachments (max 5 ảnh), Staff+ queue/transition/assign/priority
- [x] Optimistic locking (`version`), idempotency key, AuditLog
- [x] Outbox + RabbitMQ publisher + OutboxDispatcher
- [x] Unit + controller + migration + Prisma integration (43/43 pass)
- [x] Docker DB init (`nexatech_support`) + docs + HANDOFF-M13
- [x] format / lint / test / build (chạy cuối M12)

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_reporting` chưa có (volume cũ):

```sql
CREATE USER nexatech_reporting WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_reporting OWNER nexatech_reporting;
```

Rồi trong DB đó: `GRANT ALL ON SCHEMA public TO nexatech_reporting;`

Rồi: `cd apps/reporting-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M14 done

- reporting-service hoàn chỉnh: dashboard metrics + audit projection, RabbitMQ consumer/inbox, DailyMetric atomic increment, Staff+ REST.
- Shared contracts/errors + ADR-033; Docker DB init; docs + HANDOFF-M15.
- Test reporting 56/56 (integration Postgres Compose); format/lint/test/build monorepo xanh (21 projects).
- Commit `8f86457`.
- **Không bắt đầu M15 trong phiên này**.

### 2026-07-30 — M14 start

- Working tree sạch; HEAD `5c365a3` (docs M13 hash; feat M13 `b353d67`); branch `main`.
- Phạm vi M14 từ HANDOFF: `reporting-service` port `3014`, DB `nexatech_reporting`, dashboard metrics + audit projection, consume RabbitMQ (order/payment/shipping/review/warranty/support + audit), Staff+ RBAC.
- Pattern: notification-service (consumer/inbox) + projection tables.
- Không bắt đầu M15 trong phiên này.

### 2026-07-30 — M13 done

- notification-service hoàn chỉnh: in-app + email, RabbitMQ consumer/inbox, templates tiếng Việt, SMTP env.
- Shared contracts/errors + ADR-032; support outbox payload enrichment; docs + HANDOFF-M14.
- Test notification 61/61 (integration Postgres Compose); format/lint/test/build monorepo xanh.
- Commit `b353d67`.
- **Không bắt đầu M14 trong phiên này**.

### 2026-07-30 — M13 start

- Working tree sạch; HEAD `194cdec` (M12 docs hash); branch `main`.
- Phạm vi M13 từ HANDOFF: `notification-service` port `3013`, DB `nexatech_notification`, email + in-app, consume RabbitMQ events, template tiếng Việt, SMTP từ env.
- Pattern: support-service (publisher) + inbox consumer mới.
- Không bắt đầu M14 trong phiên này.

### 2026-07-30 — M12 done

- support-service hoàn chỉnh: ticket state machine, messages, attachments, assign/priority, order soft-link, outbox + RabbitMQ.
- Shared contracts/errors/events + ADR-031; docs + HANDOFF-M13.
- Test support 43/43 (integration Postgres Compose); format/lint/test/build monorepo xanh.
- Commit `7c1a582`.
- **Không bắt đầu M13 trong phiên này**.
