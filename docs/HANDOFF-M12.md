# Handoff — Chuẩn bị M12 (Support)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M12 trước DoD M11.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                        |
| -------------- | ---------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                |
| Branch         | `main`                                         |
| Milestone xong | M0–**M11** (sau khi format/lint/test/build OK) |
| Milestone tiếp | **M12** — support-service (dự kiến)            |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`  |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, shipping, review, **warranty**

---

## 2. M11 đã giao

### warranty-service (port 3011)

- Prisma DB `nexatech_warranty` + migration `20260730110000_init_warranty`
- WarrantyClaim + ReturnRequest; verified buyer qua order-service
- State machines riêng; evidence media (max 5 ảnh); staff queue/transition
- Optimistic lock + idempotency + audit + outbox
- Order sync `POST /orders/:id/return-sync` → RETURN_REQUESTED / RETURNED / DELIVERED
- Contract events only: `warranty.refund_requested`, `warranty.inventory_return_requested` (không gọi payment/inventory REST)
- Unit + controller + migration + Prisma integration (Postgres Compose)

### Shared

- Contracts: warranty/return DTOs + `WARRANTY_LIMITS` + `syncOrderReturnRequestSchema`
- Errors: `WARRANTY_*`
- Events: claim/return lifecycle + refund/inventory contract keys
- ADR-030

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:WARRANTY_DATABASE_URL='postgresql://nexatech_warranty:changeme@localhost:5432/nexatech_warranty'
pnpm exec nx run warranty-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB warranty:
# CREATE USER nexatech_warranty WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_warranty OWNER nexatech_warranty;
$env:WARRANTY_DATABASE_URL='postgresql://nexatech_warranty:changeme@localhost:5432/nexatech_warranty'
cd apps/warranty-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test warranty-service
```

---

## 4. Yêu cầu triển khai M12 — support-service (dự kiến)

Tạo `apps/support-service` (NestJS, port đề xuất `3012`):

- Ticket hỗ trợ khách hàng (Staff/Manager xử lý)
- Prisma `nexatech_support` + migration
- RBAC + audit + outbox; attachment media reference
- Có thể liên kết order / warranty claim / return (REST ID, không share DB)
- Unit + integration + migration tests
- Docs + commit M12
- **Không** bắt đầu M13 trước DoD M12

Pattern: `apps/warranty-service` / `apps/review-service`.

### Init DB cần bổ sung

- User/DB `nexatech_support` trong `init-databases.sql`
- `SUPPORT_DATABASE_URL`, `SUPPORT_PORT=3012`

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M12.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-030)
4. `apps/warranty-service` — pattern M11
5. `apps/review-service` — ticket-like moderation patterns
6. `docs/API-CONTRACTS.md` — support section (cập nhật khi làm M12)

---

## 7. Việc dang dở ngoài M12

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay / GHN credential thật khi người dùng cung cấp
- Payment consume `warranty.refund_requested`; inventory consume `warranty.inventory_return_requested`
- Catalog consumer cho `review.rating-aggregate.updated`
- Notification / reporting
- OWASP 20 scenarios sau business xong
