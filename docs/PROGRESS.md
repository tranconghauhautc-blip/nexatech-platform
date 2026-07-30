# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M13 — hoàn tất (chờ commit hash docs)
- **Milestone đã hoàn thành gần nhất:** M13 (notification-service)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — đang chạy

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
| M14–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M14.md`        |

## Commits

| Commit    | Nội dung             |
| --------- | -------------------- |
| `8526147` | M4 catalog + media   |
| `b38b723` | M5 inventory-service |
| `d2155fc` | M6 cart-service      |
| `4e2627a` | M7 order-service     |
| `1245aff` | M8 payment-service   |
| `882320f` | M9 shipping-service  |
| `7c203c6` | M9 docs hash         |
| `631cd88` | M10 review-service   |
| `d7d4905` | M10 docs hash        |
| `a60e754` | M11 warranty-service |
| `c5a1627` | M11 docs hash        |
| `7c1a582` | M12 support-service  |
| `194cdec` | M12 docs hash        |

## Apps sau M13 (20 projects)

| App                  | Port | Persistence                      |
| -------------------- | ---- | -------------------------------- |
| identity-service     | 3001 | In-memory (schema sẵn)           |
| customer-service     | 3002 | In-memory (schema sẵn)           |
| catalog-service      | 3003 | Prisma + Postgres FTS            |
| media-service        | 3004 | Prisma + MinIO                   |
| inventory-service    | 3005 | Prisma + optimistic lock         |
| cart-service         | 3006 | Prisma + Redis assist + RabbitMQ |
| order-service        | 3007 | Prisma + outbox + RabbitMQ       |
| payment-service      | 3008 | Prisma + outbox + RabbitMQ       |
| shipping-service     | 3009 | Prisma + outbox + RabbitMQ       |
| review-service       | 3010 | Prisma + outbox + RabbitMQ       |
| warranty-service     | 3011 | Prisma + outbox + RabbitMQ       |
| support-service      | 3012 | Prisma + outbox + RabbitMQ       |
| notification-service | 3013 | Prisma + inbox consumer + SMTP   |

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

Nếu DB `nexatech_notification` chưa có (volume cũ):

```sql
CREATE USER nexatech_notification WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_notification OWNER nexatech_notification;
```

Rồi trong DB đó: `GRANT ALL ON SCHEMA public TO nexatech_notification;`

Rồi: `cd apps/notification-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M13 done

- notification-service hoàn chỉnh: in-app + email, RabbitMQ consumer/inbox, templates tiếng Việt, SMTP env.
- Shared contracts/errors + ADR-032; support outbox payload enrichment; docs + HANDOFF-M14.
- Test notification 61/61 (integration Postgres Compose); format/lint/test/build monorepo.
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
