# Handoff — Chuẩn bị M15 (Frontend storefront/admin)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M15 trước DoD M14.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                               |
| -------------- | ----------------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                       |
| Branch         | `main`                                                |
| Milestone xong | M0–**M14** (`8f86457`, sau format/lint/test/build OK) |
| Milestone tiếp | **M15** — storefront-web / admin-web (Next.js)        |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`         |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, shipping, review, warranty, support, notification, **reporting**

---

## 2. M14 đã giao

### reporting-service (port 3014)

- Prisma DB `nexatech_reporting` + migration `20260730140000_init_reporting`
- Read model: Order/Payment/Shipment/Review/WarrantyClaim/WarrantyReturn/SupportTicket projections
- `DailyMetric` (atomic increment) + `AuditLogProjection` + `ProcessedEvent` inbox + `ReportingIdempotency` + `AuditLog`
- RabbitMQ **consumer** thứ hai: queue `reporting-service.events`, DLX, prefetch (`REPORTING_CONSUMER_PREFETCH`)
- REST Staff+: dashboard, metrics/daily, list projections, audit-logs, `POST /admin/reporting/audit`
- Unit + controller + handlers + migration + Prisma integration + consumer DLX — **56/56**
- Init DB Compose `nexatech_reporting`; env `REPORTING_*`
- ADR-033

### Shared

- Contracts: reporting DTOs + `REPORTING_LIMITS` + list/record schemas
- Errors: `REPORTING_*`
- Events: consume matrix (order/payment/shipping/review/warranty/support/audit) — không event mới bắt buộc

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:REPORTING_DATABASE_URL='postgresql://nexatech_reporting:changeme@localhost:5432/nexatech_reporting'
pnpm exec nx run reporting-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB reporting:
# CREATE USER nexatech_reporting WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_reporting OWNER nexatech_reporting;
# \c nexatech_reporting
# GRANT ALL ON SCHEMA public TO nexatech_reporting;
$env:REPORTING_DATABASE_URL='postgresql://nexatech_reporting:changeme@localhost:5432/nexatech_reporting'
cd apps/reporting-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test reporting-service
```

---

## 4. Yêu cầu triển khai M15 — Frontend (dự kiến)

Tạo Next.js apps theo ADR-002 / ADR-017:

- `apps/storefront-web` — website thương mại điện tử tiếng Việt (điện thoại, laptop, tablet, đồng hồ, tai nghe/loa, phụ kiện)
- `apps/admin-web` — bảng điều khiển Staff+/Admin (catalog, inventory, order, reporting dashboard…)

Gợi ý phạm vi tối thiểu M15:

- App Router + TypeScript strict
- Layout brand NexaTech, routing cơ bản
- Gọi REST `/api/v1` qua gateway/env URL (không hard-code IP production)
- Auth UX: đăng nhập/đăng ký (tích hợp identity tạm header hoặc JWT khi sẵn)
- Trang danh mục / sản phẩm đọc catalog-service
- Giỏ hàng cơ bản (cart-service)
- Admin: login RBAC + dashboard stub gọi reporting-service

**Không** bắt đầu M16 trước DoD M15.

### Không triển khai trên UI

- Voucher / mã giảm giá / flash sale / khuyến mãi
- SIM / dịch vụ viễn thông / thiết bị mạng / gia dụng

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`
- Backend M4–M14 không phá vỡ

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M15.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-002, ADR-017, ADR-033)
4. `docs/API-CONTRACTS.md` — contracts backend cần gọi từ FE
5. `apps/reporting-service` — pattern consumer gần nhất (M14)
6. `docs/ARCHITECTURE.md` — storefront/admin

---

## 7. Việc dang dở ngoài M15

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header giả lập
- Seed ~100 sản phẩm
- VNPay / GHN / SMTP credential thật khi người dùng cung cấp
- Payment consume `warranty.refund_requested`; inventory consume `warranty.inventory_return_requested`
- Catalog consumer cho `review.rating-aggregate.updated`
- Identity publish `user.registered` / OTP email qua notification
- Dockerfile từng service + Helm/Kong production
- OWASP 20 scenarios sau business xong
