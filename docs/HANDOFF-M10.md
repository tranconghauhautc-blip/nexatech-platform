# Handoff — Chuẩn bị M10 (Review)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M10 trước DoD M9.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                       |
| -------------- | --------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`               |
| Branch         | `main`                                        |
| Milestone xong | M0–**M9** (sau khi format/lint/test/build OK) |
| Milestone tiếp | **M10** — review-service                      |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true` |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, **shipping**

---

## 2. M9 đã giao

### shipping-service (port 3009)

- Prisma DB `nexatech_shipping` + migration `20260730020000_init_shipping`
- Quote (order packages, mock/rule-based fee, TTL 30m)
- Delivery slots + capacity-safe reserve
- Shipment lifecycle + outbox events
- MockShippingProvider đầy đủ; GhnShippingProvider skeleton
- Store pickup: ready-for-pickup + confirm-pickup (hash code)
- Webhook HMAC/token + payloadHash replay protection
- Order sync qua `POST /api/v1/orders/:orderId/shipping-sync`
- Inventory: event commit on PICKED_UP (`stockCommittedAt`)

### Shared / order

- Contracts: shipment/quote/slot DTOs + `syncOrderShippingRequestSchema`
- Errors: `SHIPPING_*`
- Events: shipping quote/slot + shipment lifecycle (kebab-case)
- Order: `shipping-sync` + `updateShipping`

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
pnpm exec nx run shipping-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB shipping:
# CREATE USER nexatech_shipping WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_shipping OWNER nexatech_shipping;
$env:SHIPPING_DATABASE_URL='postgresql://nexatech_shipping:changeme@localhost:5432/nexatech_shipping'
cd apps/shipping-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test shipping-service
```

---

## 4. Yêu cầu triển khai M10 — review-service

Tạo `apps/review-service` (NestJS, port đề xuất `3010`):

- Chỉ khách đã mua (order DELIVERED) mới đánh giá
- Ảnh/video đánh giá qua media-service
- Moderation cơ bản + RBAC admin
- Prisma `nexatech_review` + migration
- Consume `shipment.delivered` / `order.delivered` nếu cần
- Unit + integration + migration tests
- Docs + commit M10
- **Không** bắt đầu M11 trước DoD M10

Pattern: `apps/shipping-service` / `apps/payment-service`.

### Init DB cần bổ sung

- User/DB `nexatech_review` trong `init-databases.sql`
- `REVIEW_DATABASE_URL`, `REVIEW_PORT=3010`

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Shipping mock mặc định cho tới khi có GHN credential

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M10.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-028)
4. `apps/order-service` — delivered packages / customer
5. `apps/shipping-service` — shipment.delivered event
6. `docs/API-CONTRACTS.md` — review section (cập nhật khi làm M10)

---

## 7. Việc dang dở ngoài M10

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay / GHN credential thật khi người dùng cung cấp
- Warranty / support / notification / reporting
- OWASP 20 scenarios sau business xong
