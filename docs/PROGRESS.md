# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M7 — Order / Checkout
- **Milestone đã hoàn thành gần nhất:** M6
- **Cập nhật lần cuối:** 2026-07-29
- **Branch:** `main`
- **Kiểm tra cuối phiên:** `pnpm format` / `pnpm lint` / `pnpm test` / `pnpm build` — xanh

## Roadmap milestone

| ID     | Milestone                                 | Trạng thái  | Ghi chú                          |
| ------ | ----------------------------------------- | ----------- | -------------------------------- |
| M0     | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done     | Docs + env check                 |
| M1     | Khởi tạo Nx monorepo                      | ✅ Done     | Nx **22.7.7** + TS strict + Jest |
| M2     | Shared libraries và chuẩn nền tảng        | ✅ Done     | 7 shared libs                    |
| M3     | Identity và customer                      | ✅ Done     | Auth flows + customer profile    |
| M4     | Catalog, search và media                  | ✅ Done     | Prisma + FTS + MinIO             |
| M5     | Inventory                                 | ✅ Done     | warehouse/store/stock + RabbitMQ |
| M6     | Cart                                      | ✅ Done     | guest/user merge + Redis         |
| M7–M22 | …                                         | ⏳ Pending  | Xem `docs/HANDOFF-M7.md`         |

## Commits

| Commit    | Nội dung                                                |
| --------- | ------------------------------------------------------- |
| `8526147` | M4 catalog + media                                      |
| `b38b723` | M5 inventory-service                                    |
| _(M6)_    | `feat(m6): add cart-service with guest/user merge`      |

## Apps sau M6 (13 projects)

| App               | Port | Persistence                         |
| ----------------- | ---- | ----------------------------------- |
| identity-service  | 3001 | In-memory (schema sẵn)              |
| customer-service  | 3002 | In-memory (schema sẵn)              |
| catalog-service   | 3003 | Prisma + Postgres FTS               |
| media-service     | 3004 | Prisma + MinIO                      |
| inventory-service | 3005 | Prisma + optimistic lock            |
| cart-service      | 3006 | Prisma + Redis assist + RabbitMQ    |

## M6 đã hoàn thành

- [x] Guest cart (token an toàn + TTL)
- [x] Customer active cart CRUD
- [x] Merge guest → customer (idempotent, cộng SL, cap 99)
- [x] Catalog price refresh + validate + reservationPreview
- [x] Inventory soft availability pre-check (REST)
- [x] Redis idempotency / lock / guest TTL
- [x] Wishlist + comparison + recently viewed
- [x] Cart events RabbitMQ
- [x] Unit + concurrency + API + repository + migration + Redis tests
- [x] format / lint / test / build
- [x] Docs + HANDOFF-M7

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_cart` chưa có (volume cũ):

```sql
CREATE USER nexatech_cart WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_cart OWNER nexatech_cart;
```

Rồi: `cd apps/cart-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-29 — M6 done

- cart-service hoàn chỉnh; 22 tests xanh với Compose (Postgres + Redis).
- Handoff M7 sẵn sàng; **không bắt đầu M7 trong phiên này**.

### 2026-07-29 — M6 start

- Working tree sạch trước khi bắt đầu; HEAD `b38b723` (M5).

### 2026-07-29 — M5 done

- inventory-service hoàn chỉnh; 19 tests xanh với Compose (Postgres + RabbitMQ).
- Handoff M6 sẵn sàng; **không bắt đầu M6 trong phiên này**.
