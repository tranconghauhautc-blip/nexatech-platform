# Handoff — Chuẩn bị M7 (Order / Checkout)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M7 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-29**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0–**M6**                                     |
| Milestone tiếp | **M7** — order-service / checkout             |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx (13)

- Libs: 7 shared (`platform`, `errors`, `config`, `auth`, `contracts`, `events`, `logging`)
- Apps: identity, customer, catalog, media, inventory, **cart**

---

## 2. M6 đã giao

### cart-service (port 3006)

- Prisma DB `nexatech_cart` + migration `20260729160000_init_cart`
- Guest cart (secure token + SHA-256 hash + TTL 30 ngày)
- Customer active cart (một ACTIVE / customer)
- Add / update / remove / clear items
- Merge guest → customer (cộng SL, cap 99, idempotent, guest → CONVERTED)
- Refresh giá từ catalog; validate + `reservationPreview` (chưa reserve)
- Soft inventory pre-check qua REST (`INVENTORY_SERVICE_URL`)
- Catalog REST (`CATALOG_SERVICE_URL`) — SKU + product status
- Redis: idempotency NX, distributed lock, guest token meta TTL
- Wishlist / comparison (max 4) / recently viewed
- RabbitMQ events: created, item.\*, merged, converted, expired
- Optimistic locking `Cart.version`

### Events đã chuẩn hóa thêm

- `cart.created` / `cart.item.added` / `.updated` / `.removed`
- `cart.merged` / `cart.converted` / `cart.expired`

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB cart:
# CREATE USER nexatech_cart WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_cart OWNER nexatech_cart;
$env:CART_DATABASE_URL='postgresql://nexatech_cart:changeme@localhost:5432/nexatech_cart'
$env:REDIS_URL='redis://localhost:6379'
$env:RABBITMQ_URL='amqp://guest:guest@localhost:5672'
cd apps/cart-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test cart-service
```

---

## 4. Yêu cầu triển khai M7 — order-service

Tạo `apps/order-service` (NestJS, port đề xuất `3007`):

- Checkout từ cart (customer)
- Validate cart + inventory reserve (gọi inventory REST)
- Tạo order + tách kiện nếu cần
- Status lifecycle order
- Consume / emit events liên quan payment/shipping
- Prisma `nexatech_order` + migration + repository thật
- In-memory chỉ unit test
- Unit + repository + API + migration tests
- Cập nhật docs + commit M7
- **Không** bắt đầu M8 trước DoD M7

Pattern: `apps/cart-service` / `apps/inventory-service`.

### Init DB cần bổ sung

- User/DB `nexatech_order` trong `init-databases.sql`
- `ORDER_DATABASE_URL`, `ORDER_PORT=3007` trong `.env.example`
- Env phụ thuộc: `CART_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `CATALOG_SERVICE_URL`, `PAYMENT_SERVICE_URL` (khi có)

Lưu ý volume Postgres cũ: tạo user/DB thủ công nếu thiếu (không `migrate reset`).

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale/SIM/thiết bị mạng/gia dụng
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Không Docker tag `latest`; không app user `postgres`
- Snapshot giá cart **không** phải giá cuối khi checkout — order phải re-price

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M7.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-023 → ADR-025)
4. `AGENTS.md` + `.cursor/rules/00-nexatech.mdc`
5. `docs/API-CONTRACTS.md`, `DATABASES.md`, `EVENTS.md`
6. Pattern: `apps/cart-service/src/app/cart/*`
7. Inventory reserve API + cart `reservationPreview`

---

## 7. Việc dang dở ngoài M7

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- Payment / shipping adapters (M8+)
