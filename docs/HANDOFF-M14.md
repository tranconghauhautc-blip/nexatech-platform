# Handoff — Chuẩn bị M14 (Reporting)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M14 trước DoD M13.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                        |
| -------------- | ---------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                |
| Branch         | `main`                                         |
| Milestone xong | M0–**M13** (sau khi format/lint/test/build OK) |
| Milestone tiếp | **M14** — reporting-service (dự kiến)          |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`  |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, shipping, review, warranty, support, **notification**

---

## 2. M13 đã giao

### notification-service (port 3013)

- Prisma DB `nexatech_notification` + migration `20260730130000_init_notification`
- InAppNotification + EmailDelivery + ProcessedEvent (inbox) + idempotency + AuditLog
- RabbitMQ **consumer** đầu tiên: queue `notification-service.events`, DLX, prefetch
- Template tiếng Việt; SMTP từ `SMTP_*` env (LoggingEmailSender khi thiếu SMTP)
- REST: list/unread/read/read-all/delete + Staff+ request + admin email deliveries
- Support outbox payload bổ sung `customerId`/`assigneeId`/`ticketCode` (additive)
- Unit + controller + migration + Prisma integration (Postgres Compose) — 61/61

### Shared

- Contracts: notification DTOs + `NOTIFICATION_LIMITS` + list/request schemas
- Errors: `NOTIFICATION_*`
- Events: đã có `NOTIFICATION_REQUESTED` + consumer matrix
- ADR-032

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:NOTIFICATION_DATABASE_URL='postgresql://nexatech_notification:changeme@localhost:5432/nexatech_notification'
pnpm exec nx run notification-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB notification:
# CREATE USER nexatech_notification WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_notification OWNER nexatech_notification;
# \c nexatech_notification
# GRANT ALL ON SCHEMA public TO nexatech_notification;
$env:NOTIFICATION_DATABASE_URL='postgresql://nexatech_notification:changeme@localhost:5432/nexatech_notification'
cd apps/notification-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test notification-service
```

---

## 4. Yêu cầu triển khai M14 — reporting-service (dự kiến)

Tạo `apps/reporting-service` (NestJS, port đề xuất `3014`):

- Dashboard metrics + audit log projection (read model)
- Consume RabbitMQ events từ order/payment/shipping/review/warranty/support
- Prisma `nexatech_reporting` + migration
- RBAC Staff+ cho dashboard; không ghi vào DB service khác
- Unit + integration + migration tests
- Docs + commit M14
- **Không** bắt đầu M15 trước DoD M14

Pattern: `apps/notification-service` (consumer/inbox) + projection tables.

### Init DB cần bổ sung

- User/DB `nexatech_reporting` trong `init-databases.sql`
- `REPORTING_DATABASE_URL`, `REPORTING_PORT=3014`

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M14.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-032)
4. `apps/notification-service` — pattern consumer/inbox M13
5. `docs/EVENTS.md` — reporting consumer matrix
6. `docs/API-CONTRACTS.md` — reporting section (cập nhật khi làm M14)

---

## 7. Việc dang dở ngoài M14

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay / GHN / SMTP credential thật khi người dùng cung cấp
- Payment consume `warranty.refund_requested`; inventory consume `warranty.inventory_return_requested`
- Catalog consumer cho `review.rating-aggregate.updated`
- Identity publish `user.registered` / OTP email qua notification
- OWASP 20 scenarios sau business xong
- Frontend storefront/admin (M15+)
