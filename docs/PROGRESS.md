# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M9 — Shipping
- **Milestone đã hoàn thành gần nhất:** M8
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — (đang chạy sau M8)

## Roadmap milestone

| ID     | Milestone                                 | Trạng thái | Ghi chú                          |
| ------ | ----------------------------------------- | ---------- | -------------------------------- |
| M0     | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done    | Docs + env check                 |
| M1     | Khởi tạo Nx monorepo                      | ✅ Done    | Nx **22.7.7** + TS strict + Jest |
| M2     | Shared libraries và chuẩn nền tảng        | ✅ Done    | 7 shared libs                    |
| M3     | Identity và customer                      | ✅ Done    | Auth flows + customer profile    |
| M4     | Catalog, search và media                  | ✅ Done    | Prisma + FTS + MinIO             |
| M5     | Inventory                                 | ✅ Done    | warehouse/store/stock + RabbitMQ |
| M6     | Cart                                      | ✅ Done    | guest/user merge + Redis         |
| M7     | Order / Checkout                          | ✅ Done    | order-service + outbox           |
| M8     | Payment                                   | ✅ Done    | payment-service + VNPay/MOCK/COD |
| M9–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M9.md`         |

## Commits

| Commit      | Nội dung             |
| ----------- | -------------------- |
| `8526147`   | M4 catalog + media   |
| `b38b723`   | M5 inventory-service |
| `d2155fc`   | M6 cart-service      |
| `4e2627a`   | M7 order-service     |
| _(pending)_ | M8 payment-service   |

## Apps sau M8 (15 projects)

| App               | Port | Persistence                      |
| ----------------- | ---- | -------------------------------- |
| identity-service  | 3001 | In-memory (schema sẵn)           |
| customer-service  | 3002 | In-memory (schema sẵn)           |
| catalog-service   | 3003 | Prisma + Postgres FTS            |
| media-service     | 3004 | Prisma + MinIO                   |
| inventory-service | 3005 | Prisma + optimistic lock         |
| cart-service      | 3006 | Prisma + Redis assist + RabbitMQ |
| order-service     | 3007 | Prisma + outbox + RabbitMQ       |
| payment-service   | 3008 | Prisma + outbox + RabbitMQ       |

## M8 đã hoàn thành

- [x] Shared contracts / errors / events cho payment
- [x] payment-service Prisma + migration `nexatech_payment`
- [x] COD / MOCK / VNPay Sandbox adapters
- [x] Payment intent, state machine, idempotency, outbox
- [x] Refund domain (full/partial) + mock refund adapter
- [x] Order sync (`payment-sync`) + events
- [x] Unit + API + concurrency + integration + migration tests
- [x] Docker init DB / env
- [x] Docs + HANDOFF-M9

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_payment` chưa có (volume cũ):

```sql
CREATE USER nexatech_payment WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_payment OWNER nexatech_payment;
```

Rồi: `cd apps/payment-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M8 done

- payment-service hoàn chỉnh; COD/MOCK/VNPay; refund domain; outbox; order payment-sync.
- Shared contracts/errors/events; docs + HANDOFF-M9.
- **Không bắt đầu M9 trong phiên này**.

### 2026-07-30 — M8 start

- Working tree sạch; HEAD `609e45c` (M7 docs); baseline format/lint/test/build xanh.

### 2026-07-30 — M7 done

- order-service hoàn chỉnh; unit/API/concurrency xanh; integration/migration skip khi thiếu `ORDER_DATABASE_URL`.
- Cart convert API + shared contracts/errors/events.
- Handoff M8 sẵn sàng; **không bắt đầu M8 trong phiên đó**.
