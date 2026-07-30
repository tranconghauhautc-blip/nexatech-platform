# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M10 — Review
- **Milestone đã hoàn thành gần nhất:** M9
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — xanh (sau M9)

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
| M10–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M10.md`        |

## Commits

| Commit      | Nội dung             |
| ----------- | -------------------- |
| `8526147`   | M4 catalog + media   |
| `b38b723`   | M5 inventory-service |
| `d2155fc`   | M6 cart-service      |
| `4e2627a`   | M7 order-service     |
| `1245aff`   | M8 payment-service   |
| `882320f`   | M9 shipping-service  |

## Apps sau M9 (16 projects)

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
| shipping-service  | 3009 | Prisma + outbox + RabbitMQ       |

## M9 đã hoàn thành

- [x] Shared contracts / errors / events cho shipping
- [x] shipping-service Prisma + migration `nexatech_shipping`
- [x] Quote, slot, shipment state machine, mock/GHN skeleton
- [x] Store pickup code + webhook + outbox
- [x] Order sync (`shipping-sync`)
- [x] Unit + API + migration tests
- [x] Docker init DB / env
- [x] Docs + HANDOFF-M10
- [x] format / lint / test / build xanh

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_shipping` chưa có (volume cũ):

```sql
CREATE USER nexatech_shipping WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_shipping OWNER nexatech_shipping;
```

Rồi: `cd apps/shipping-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M9 done

- shipping-service hoàn chỉnh; quote/slot/shipment; mock + GHN skeleton; store pickup; webhook; outbox; order shipping-sync.
- Shared contracts/errors/events; docs + HANDOFF-M10.
- **Không bắt đầu M10 trong phiên này**.

### 2026-07-30 — M9 start

- Working tree sạch; HEAD `4e14ec7`; baseline format/lint/test/build xanh.

### 2026-07-30 — M8 done

- payment-service hoàn chỉnh; COD/MOCK/VNPay; refund domain; outbox; order payment-sync.
