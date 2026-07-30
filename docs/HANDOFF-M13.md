# Handoff — Chuẩn bị M13 (Notification)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M13 trước DoD M12.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                        |
| -------------- | ---------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                |
| Branch         | `main`                                         |
| Milestone xong | M0–**M12** (sau khi format/lint/test/build OK) |
| Milestone tiếp | **M13** — notification-service (dự kiến)       |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`  |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, shipping, review, warranty, **support**

---

## 2. M12 đã giao

### support-service (port 3012)

- Prisma DB `nexatech_support` + migration `20260730120000_init_support`
- SupportTicket + Message + Attachment + History
- State machine: OPEN → IN_PROGRESS → WAITING_CUSTOMER|RESOLVED|CLOSED; customer message WAITING_CUSTOMER → WAITING_STAFF; RESOLVED → CLOSED|reopen
- Optional link orderId (ownership qua order REST) / warrantyClaimId / returnRequestId (opaque REST IDs)
- Media attachments max 5 ảnh; Staff+ queue/transition/assign/priority
- Optimistic lock + idempotency + audit + outbox
- Unit + controller + migration + Prisma integration (Postgres Compose) — 43/43

### Shared

- Contracts: support ticket DTOs + `SUPPORT_LIMITS` + transition/assign/priority schemas
- Errors: `SUPPORT_*`
- Events: ticket lifecycle + message_added
- ADR-031

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:SUPPORT_DATABASE_URL='postgresql://nexatech_support:changeme@localhost:5432/nexatech_support'
pnpm exec nx run support-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB support:
# CREATE USER nexatech_support WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_support OWNER nexatech_support;
$env:SUPPORT_DATABASE_URL='postgresql://nexatech_support:changeme@localhost:5432/nexatech_support'
cd apps/support-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test support-service
```

---

## 4. Yêu cầu triển khai M13 — notification-service (dự kiến)

Tạo `apps/notification-service` (NestJS, port đề xuất `3013`):

- Email + in-app notification
- Consume RabbitMQ events từ identity/order/payment/shipping/review/warranty/support
- Prisma `nexatech_notification` + migration
- Template tiếng Việt; không hard-code SMTP secret
- Unit + integration + migration tests
- Docs + commit M13
- **Không** bắt đầu M14 trước DoD M13

Pattern: `apps/support-service` (outbox consumer side) / các service publish trước.

### Init DB cần bổ sung

- User/DB `nexatech_notification` trong `init-databases.sql`
- `NOTIFICATION_DATABASE_URL`, `NOTIFICATION_PORT=3013`
- SMTP / Gmail App Password — chỉ khi người dùng cung cấp

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M13.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-031)
4. `apps/support-service` — pattern M12 outbox publisher
5. `docs/EVENTS.md` — consumer matrix
6. `docs/API-CONTRACTS.md` — notification section (cập nhật khi làm M13)

---

## 7. Việc dang dở ngoài M13

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay / GHN credential thật khi người dùng cung cấp
- Payment consume `warranty.refund_requested`; inventory consume `warranty.inventory_return_requested`
- Catalog consumer cho `review.rating-aggregate.updated`
- Reporting-service
- OWASP 20 scenarios sau business xong
