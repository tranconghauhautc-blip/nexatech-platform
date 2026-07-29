# Handoff — Chuẩn bị M6 (Cart)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M6 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-29**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0–**M5**                                     |
| Milestone tiếp | **M6** — cart-service                         |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx (12)

- Libs: 7 shared (`platform`, `errors`, `config`, `auth`, `contracts`, `events`, `logging`)
- Apps: identity, customer, catalog, media, **inventory**

---

## 2. M5 đã giao

### inventory-service (port 3005)

- Prisma DB `nexatech_inventory` + migration `20260729140000_init_inventory`
- Warehouse / Store / StockItem (onHand, reserved, version)
- Reserve / release / commit / return / receive / issue / transfer / adjust
- IdempotencyRecord + optimistic locking
- Movement history + low-stock detection
- Source selection (ưu tiên store theo city)
- RabbitMQ publisher (`RABBITMQ_URL`) + in-memory publisher cho test
- REST public + admin Staff+ (`x-user-roles`)

### Events đã chuẩn hóa

- `inventory.reservation.created` / `.released`
- `inventory.stock.committed` / `.returned`
- `inventory.transfer.created` / `.completed`
- `inventory.low-stock.detected`

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
$env:INVENTORY_DATABASE_URL='postgresql://nexatech_inventory:changeme@localhost:5432/nexatech_inventory'
$env:RABBITMQ_URL='amqp://guest:guest@localhost:5672'
pnpm exec nx test inventory-service
```

---

## 4. Yêu cầu triển khai M6 — cart-service

Tạo `apps/cart-service` (NestJS, port đề xuất `3006`):

- Guest cart + user cart
- Merge cart khi đăng nhập
- Wishlist
- So sánh sản phẩm (comparison)
- Sản phẩm đã xem (recently viewed)
- Gợi ý rule-based (có thể gọi catalog recommendations)
- Validate tồn qua inventory REST khi add-to-cart (optional soft check)
- Prisma `nexatech_cart` + migration + repository thật
- In-memory chỉ unit test
- Event: `cart.merged`
- Unit + repository + API + migration tests
- Cập nhật docs + commit M6
- **Không** bắt đầu M7 trước DoD M6

Pattern: `apps/inventory-service` / `apps/catalog-service`.

### Init DB cần bổ sung

- User/DB `nexatech_cart` trong `init-databases.sql`
- `CART_DATABASE_URL`, `CART_PORT=3006` trong `.env.example`

Lưu ý volume Postgres cũ: tạo user/DB thủ công nếu thiếu (không `migrate reset`).

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale/SIM/thiết bị mạng/gia dụng
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Không Docker tag `latest`; không app user `postgres`

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M6.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-023, ADR-024)
4. `AGENTS.md` + `.cursor/rules/00-nexatech.mdc`
5. `docs/API-CONTRACTS.md`, `DATABASES.md`, `EVENTS.md`
6. Pattern: `apps/inventory-service/src/app/inventory/*`
7. Shared contracts/events cho cart

---

## 7. Việc dang dở ngoài M6

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- Order/checkout orchestration (M7+)
