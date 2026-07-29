# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M6 — Cart, wishlist, so sánh, recently viewed
- **Milestone đã hoàn thành gần nhất:** M5
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
| M6     | Cart                                      | ⏳ **Next** | Xem `docs/HANDOFF-M6.md`         |
| M7–M22 | …                                         | ⏳ Pending  | Roadmap gốc                      |

## Commits

| Commit    | Nội dung                                                |
| --------- | ------------------------------------------------------- |
| `8526147` | M4 catalog + media                                      |
| _(M5)_    | `feat(m5): add inventory-service with stock operations` |

## Apps sau M5 (12 projects)

| App               | Port | Persistence              |
| ----------------- | ---- | ------------------------ |
| identity-service  | 3001 | In-memory (schema sẵn)   |
| customer-service  | 3002 | In-memory (schema sẵn)   |
| catalog-service   | 3003 | Prisma + Postgres FTS    |
| media-service     | 3004 | Prisma + MinIO           |
| inventory-service | 3005 | Prisma + optimistic lock |

## M5 đã hoàn thành

- [x] Warehouse + Store CRUD
- [x] Stock on-hand / reserved / available
- [x] Receive, issue, reserve, release, commit, return, transfer, adjust
- [x] Movement history + low-stock alert
- [x] Availability check + source selection
- [x] Idempotency + optimistic locking (chống oversell)
- [x] RabbitMQ event publisher (`amqplib`)
- [x] Unit + concurrency + API + repository + migration + RabbitMQ smoke tests
- [x] format / lint / test / build xanh
- [x] Docs + HANDOFF-M6

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.

## Local note (Postgres volume đã init)

Nếu DB `nexatech_inventory` chưa có (volume cũ):

```sql
CREATE USER nexatech_inventory WITH PASSWORD 'changeme';
CREATE DATABASE nexatech_inventory OWNER nexatech_inventory;
```

Rồi: `cd apps/inventory-service && npx prisma migrate deploy && npx prisma generate`

## Nhật ký

### 2026-07-29 — M5 done

- inventory-service hoàn chỉnh; 19 tests xanh với Compose (Postgres + RabbitMQ).
- Handoff M6 sẵn sàng; **không bắt đầu M6 trong phiên này**.
