# Handoff — Chuẩn bị M9 (Shipping)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M9 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0–**M8**                                     |
| Milestone tiếp | **M9** — shipping-service                     |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx (15+)

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, **payment**

---

## 2. M8 đã giao

### payment-service (port 3008)

- Prisma DB `nexatech_payment` + migration `20260730010000_init_payment`
- Providers: COD, MOCK, VNPay Sandbox (HMAC-SHA512)
- Payment intent từ order thật (không tin amount từ body)
- State machine + idempotency + outbox events
- Mock succeed/fail/cancel
- VNPay return + IPN (verify signature/amount/replay)
- Refund domain (full/partial) + mock refund adapter
- Order sync qua `POST /api/v1/orders/:orderId/payment-sync`

### Shared / order

- Contracts: create/cancel/refund/list payment + `PaymentDto` / `RefundDto`
- Errors: `PAYMENT_*`
- Events: payment lifecycle keys đầy đủ
- Order: `payment-sync` + `updatePayment` repository

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
# Nếu volume Postgres cũ chưa có DB payment:
# CREATE USER nexatech_payment WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_payment OWNER nexatech_payment;
$env:PAYMENT_DATABASE_URL='postgresql://nexatech_payment:changeme@localhost:5432/nexatech_payment'
cd apps/payment-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test payment-service
```

---

## 4. Yêu cầu triển khai M9 — shipping-service

Tạo `apps/shipping-service` (NestJS, port đề xuất `3009`):

- ShippingProvider interface + mock carrier (adapter thật khi có API key)
- Liên kết order packages / tracking
- Consume `order.package.created` / `order.ready-to-ship` / `order.shipped`
- Cập nhật tracking → order package status
- Prisma `nexatech_shipping` + migration
- Unit + integration + migration tests
- Docs + commit M9
- **Không** bắt đầu M10 trước DoD M9

Pattern: `apps/payment-service` / `apps/order-service`. Env sẵn: `SHIPPING_SERVICE_URL`.

### Init DB cần bổ sung

- User/DB `nexatech_shipping` trong `init-databases.sql`
- `SHIPPING_DATABASE_URL`, `SHIPPING_PORT=3009`
- Carrier API credential từ người dùng khi cần thật

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Shipping mock mặc định cho tới khi có carrier credential

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M9.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-010, ADR-027)
4. `apps/order-service` — packages / tracking fields
5. `apps/payment-service` — adapter + outbox pattern
6. `docs/API-CONTRACTS.md` / `EVENTS.md` — shipping section

---

## 7. Việc dang dở ngoài M9

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay refund thật khi có sandbox contract
- Review / warranty / support / notification / reporting
