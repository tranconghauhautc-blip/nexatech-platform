# Handoff — Chuẩn bị M8 (Payment)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M8 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0–**M7**                                     |
| Milestone tiếp | **M8** — payment-service                      |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx (14)

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, **order**

---

## 2. M7 đã giao

### order-service (port 3007)

- Prisma DB `nexatech_order` + migration `20260730000000_init_order`
- Tạo đơn từ authenticated cart (re-price catalog, validate cart, inventory reserve)
- Snapshot item/address/totals (Int VND, discount=0)
- State machine + history + audit
- Packages theo nguồn reservation (warehouse/store)
- Idempotency create/cancel/transition; optimistic `Order.version`
- Outbox → RabbitMQ (`order.created`, `.confirmed`, `.cancelled`, `.package.created`, status events, …)
- Cart convert API: `POST /api/v1/carts/convert`
- Compensation: convert fail → release reservation + `FAILED`

### Shared

- Contracts: create/cancel/confirm/transition/list schemas + `OrderDto`
- Errors: `ORDER_*`
- Events: đầy đủ order lifecycle keys

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
# Nếu volume Postgres cũ chưa có DB order:
# CREATE USER nexatech_order WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_order OWNER nexatech_order;
$env:ORDER_DATABASE_URL='postgresql://nexatech_order:changeme@localhost:5432/nexatech_order'
cd apps/order-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test order-service
```

---

## 4. Yêu cầu triển khai M8 — payment-service

Tạo `apps/payment-service` (NestJS, port đề xuất `3008`):

- Providers: COD, MOCK, VNPay Sandbox (adapter)
- Liên kết `orderId` / payment reference mà order đã lưu sẵn
- Consume / phản hồi `order.created` / `order.cancelled` (refund contract)
- Cập nhật payment status → order confirm/fail qua REST hoặc event
- Prisma `nexatech_payment` + migration
- Unit + integration + migration tests
- Docs + commit M8
- **Không** bắt đầu M9 trước DoD M8

Pattern: `apps/order-service`. Env sẵn: `PAYMENT_SERVICE_URL`, order đã có `paymentMethod` / `paymentStatus` / `refundContractStatus`.

### Init DB cần bổ sung

- User/DB `nexatech_payment` trong `init-databases.sql`
- `PAYMENT_DATABASE_URL`, `PAYMENT_PORT=3008`
- VNPay sandbox credentials từ người dùng khi cần thật

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- VNPay chỉ Sandbox cho tới khi có credential production

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M8.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-009, ADR-026)
4. `apps/order-service/src/app/order/*` — payment linkage fields
5. `docs/API-CONTRACTS.md` / `EVENTS.md` — payment section

---

## 7. Việc dang dở ngoài M8

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- Shipping-service (M9+)
