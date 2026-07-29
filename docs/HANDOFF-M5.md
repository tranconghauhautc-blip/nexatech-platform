# Handoff — Chuẩn bị M5 (Inventory)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M5 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-29**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0, M1, M2, M3, **M4**                        |
| Milestone tiếp | **M5** — inventory-service                    |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx (11)

- Libs: `shared-platform`, `shared-errors`, `shared-config`, `shared-auth`, `shared-contracts`, `shared-events`, `shared-logging`
- Apps: `identity-service`, `customer-service`, `catalog-service`, `media-service`

---

## 2. M4 đã giao

### catalog-service (port 3003)

- Prisma DB `nexatech_catalog` + migration FTS (`searchVector`)
- Repository interface + `PrismaCatalogRepository` + `InMemoryCatalogRepository` (test only)
- Category tree, brand, spec templates, product/SKU/price history, media links
- Public search/filter/sort/pagination + recommendations
- Admin CRUD Staff+ via `x-user-roles`

### media-service (port 3004)

- Prisma DB `nexatech_media`
- MinIO adapter (`minio` package) + in-memory storage double
- Presign upload/download, confirm, delete, links, orphan cleanup
- MIME allowlist + size limit + safe object keys

### Infra

- Compose: Postgres 16, Redis, RabbitMQ, MinIO, `minio-init` buckets
- `.env.example` có `CATALOG_*`, `MEDIA_*`, `MINIO_*`

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
pnpm format
pnpm lint
pnpm test
pnpm build
```

Integration (cần Compose):

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
$env:CATALOG_DATABASE_URL='postgresql://nexatech_catalog:changeme@localhost:5432/nexatech_catalog'
$env:MEDIA_DATABASE_URL='postgresql://nexatech_media:changeme@localhost:5432/nexatech_media'
$env:MINIO_ENDPOINT='localhost'
$env:MINIO_ACCESS_KEY='minioadmin'
$env:MINIO_SECRET_KEY='minioadmin'
pnpm exec nx test catalog-service
pnpm exec nx test media-service
```

---

## 4. Yêu cầu triển khai M5 — inventory-service

Tạo `apps/inventory-service` (NestJS, port đề xuất `3005`):

- Nhiều kho (`Warehouse`) và cửa hàng (`Store`)
- Tồn theo SKU + warehouse
- Giữ chỗ (reserve), trừ (commit), hoàn (release), điều chuyển (transfer)
- Validation không âm / oversell
- Events: `inventory.reserved`, `inventory.reservation_released`, `inventory.stock_low`
- Prisma `nexatech_inventory` + migration + repository thật
- In-memory chỉ unit test double
- REST `/api/v1` + Swagger + health + RBAC Staff+
- Unit + repository integration + API + migration tests
- Cập nhật docs + commit M5
- **Không** bắt đầu M6 trước khi DoD M5 xong

Pattern tham chiếu: `apps/catalog-service` (Prisma repository + module wiring).

### Init DB cần bổ sung

- User/DB `nexatech_inventory` trong `infra/docker/postgres/init-databases.sql`
- `INVENTORY_DATABASE_URL` trong `.env.example`

Lưu ý: volume Postgres đã init — nếu DB cũ thiếu user mới, tạo thủ công hoặc recreate volume **chỉ khi người dùng xác nhận** (không tự `migrate reset`).

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale/SIM/thiết bị mạng/gia dụng
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Không Docker tag `latest`; không app user `postgres`

---

## 6. File đọc đầu tiên (Agent mới)

1. `docs/HANDOFF-M5.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-023 persistence)
4. `AGENTS.md` + `.cursor/rules/00-nexatech.mdc`
5. `docs/ARCHITECTURE.md`, `API-CONTRACTS.md`, `DATABASES.md`, `EVENTS.md`
6. Pattern: `apps/catalog-service/src/app/catalog/*`
7. Shared: contracts, events (`INVENTORY_*`), errors, auth

---

## 7. Việc dang dở ngoài M5

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm (milestone catalog/seed sau)
- RabbitMQ publisher thật (hiện audit events in-process)
