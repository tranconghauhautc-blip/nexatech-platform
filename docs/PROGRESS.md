# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M11 — Warranty
- **Milestone đã hoàn thành gần nhất:** M10
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra cuối phiên:** format / lint / test / build — xanh (sau M10)

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
| M11–M22 | …                                         | ⏳ Pending | Xem `docs/HANDOFF-M11.md`        |

## Commits

| Commit      | Nội dung             |
| ----------- | -------------------- |
| `8526147`   | M4 catalog + media   |
| `b38b723`   | M5 inventory-service |
| `d2155fc`   | M6 cart-service      |
| `4e2627a`   | M7 order-service     |
| `1245aff`   | M8 payment-service   |
| `882320f`   | M9 shipping-service  |
| `7c203c6`   | M9 docs hash         |
| _(pending)_ | M10 review-service   |

## Apps sau M10 (17 projects)

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
| review-service    | 3010 | Prisma + outbox + RabbitMQ       |

## M10 đã hoàn thành

- [x] Shared contracts / errors / events cho review
- [x] review-service Prisma + migration `nexatech_review`
- [x] Verified buyer, lifecycle, media, reply, helpful, report, moderation
- [x] Rating aggregate + rebuild
- [x] Unit + API + migration tests
- [x] Docker init DB / env
- [x] Docs + HANDOFF-M11
- [x] format / lint / test / build xanh

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_review` chưa có (volume cũ):

```sql
CREATE USER nexatech_review WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_review OWNER nexatech_review;
```

Rồi: `cd apps/review-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-30 — M10 done

- review-service hoàn chỉnh; verified buyer; moderation; aggregate; media/reply/report/helpful; outbox.
- Shared contracts/errors/events; docs + HANDOFF-M11.
- **Không bắt đầu M11 trong phiên này**.

### 2026-07-30 — M10 start

- Working tree sạch; HEAD `7c203c6` (M9 docs); branch `main` đồng bộ `origin/main`.
- Apps M4–M9 tồn tại; `review-service` chưa có.
- Baseline format / lint / test / build xanh.
- Bắt đầu triển khai review-service (verified buyer, moderation, aggregate, media, reply, report).

### 2026-07-30 — M9 done

- shipping-service hoàn chỉnh; quote/slot/shipment; mock + GHN skeleton; store pickup; webhook; outbox; order shipping-sync.
- Shared contracts/errors/events; docs + HANDOFF-M10.
- **Không bắt đầu M10 trong phiên này**.

### 2026-07-30 — M9 start

- Working tree sạch; HEAD `4e14ec7`; baseline format/lint/test/build xanh.

### 2026-07-30 — M8 done

- payment-service hoàn chỉnh; COD/MOCK/VNPay; refund domain; outbox; order payment-sync.
