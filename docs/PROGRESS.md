# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M8 — Payment
- **Milestone đã hoàn thành gần nhất:** M7
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — xanh (sau M7)

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
| M8–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M8.md`         |

## Commits

| Commit    | Nội dung                                               |
| --------- | ------------------------------------------------------ |
| `8526147` | M4 catalog + media                                     |
| `b38b723` | M5 inventory-service                                   |
| `d2155fc` | M6 cart-service                                        |
| _(M7)_    | `feat(m7): add order-service with checkout and outbox` |

## Apps sau M7 (14 projects)

| App               | Port | Persistence                      |
| ----------------- | ---- | -------------------------------- |
| identity-service  | 3001 | In-memory (schema sẵn)           |
| customer-service  | 3002 | In-memory (schema sẵn)           |
| catalog-service   | 3003 | Prisma + Postgres FTS            |
| media-service     | 3004 | Prisma + MinIO                   |
| inventory-service | 3005 | Prisma + optimistic lock         |
| cart-service      | 3006 | Prisma + Redis assist + RabbitMQ |
| order-service     | 3007 | Prisma + outbox + RabbitMQ       |

## M7 đã hoàn thành

- [x] Shared contracts / errors / events cho order
- [x] Cart convert API (`POST /api/v1/carts/convert`)
- [x] order-service Prisma + migration `nexatech_order`
- [x] Create order từ cart (re-price, reserve, snapshot, packages)
- [x] State machine + cancel + confirm + admin query
- [x] Outbox events
- [x] Unit + concurrency + API + repository + migration tests
- [x] format / lint / test / build
- [x] Docs + HANDOFF-M8

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_order` chưa có (volume cũ):

```sql
CREATE USER nexatech_order WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_order OWNER nexatech_order;
```

Rồi: `cd apps/order-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M7 done

- order-service hoàn chỉnh; unit/API/concurrency xanh; integration/migration skip khi thiếu `ORDER_DATABASE_URL`.
- Cart convert API + shared contracts/errors/events.
- Handoff M8 sẵn sàng; **không bắt đầu M8 trong phiên này**.

### 2026-07-30 — M7 start

- Working tree sạch; HEAD `d2155fc` (M6); baseline format/lint/test/build xanh.

### 2026-07-29 — M6 done

- cart-service hoàn chỉnh; Handoff M7 sẵn sàng.
