# Handoff — Chuẩn bị M11 (Warranty)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M11 trước DoD M10.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                        |
| -------------- | ---------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                |
| Branch         | `main`                                         |
| Milestone xong | M0–**M10** (sau khi format/lint/test/build OK) |
| Milestone tiếp | **M11** — warranty-service                     |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`  |

### Projects Nx

- Libs: 7 shared
- Apps: identity, customer, catalog, media, inventory, cart, order, payment, shipping, **review**

---

## 2. M10 đã giao

### review-service (port 3010)

- Prisma DB `nexatech_review` + migration `20260730030000_init_review`
- Verified buyer qua order-service (DELIVERED + ownership + orderItem)
- Review lifecycle PENDING/PUBLISHED/HIDDEN/REJECTED/DELETED
- Media reference (max 5 ảnh + 1 video), store reply, helpful votes, reports
- ProductRatingAggregate (integer cents) + rebuild admin
- Outbox events `review.*`
- Unit + controller + migration tests; Prisma integration khi có `REVIEW_DATABASE_URL`

### Shared

- Contracts: review DTOs/schemas + `REVIEW_LIMITS`
- Errors: `REVIEW_*`
- Events: review lifecycle / reply / report / helpful / rating-aggregate

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
pnpm exec nx run review-service:prisma-generate
pnpm format; pnpm lint; pnpm test; pnpm build
```

Integration:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# Nếu volume Postgres cũ chưa có DB review:
# CREATE USER nexatech_review WITH PASSWORD 'changeme';
# CREATE DATABASE nexatech_review OWNER nexatech_review;
$env:REVIEW_DATABASE_URL='postgresql://nexatech_review:changeme@localhost:5432/nexatech_review'
cd apps/review-service; npx prisma migrate deploy; cd ../..
pnpm exec nx test review-service
```

---

## 4. Yêu cầu triển khai M11 — warranty-service

Tạo `apps/warranty-service` (NestJS, port đề xuất `3011`):

- Bảo hành / đổi trả gắn order đã mua
- Prisma `nexatech_warranty` + migration
- RBAC + audit + outbox
- Unit + integration + migration tests
- Docs + commit M11
- **Không** bắt đầu M12 trước DoD M11

Pattern: `apps/review-service` / `apps/shipping-service`.

### Init DB cần bổ sung

- User/DB `nexatech_warranty` trong `init-databases.sql`
- `WARRANTY_DATABASE_URL`, `WARRANTY_PORT=3011`

---

## 5. Ràng buộc giữ nguyên

- Nx **22.7.7**, không nâng 23.x
- Không voucher/flash sale
- Không hard-code secret; không commit `.env`
- Không `prisma db push` production / không `migrate reset`

---

## 6. File đọc đầu tiên

1. `docs/HANDOFF-M11.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (ADR-029)
4. `apps/review-service` — pattern M10
5. `apps/order-service` — delivered items
6. `docs/API-CONTRACTS.md` — warranty section (cập nhật khi làm M11)

---

## 7. Việc dang dở ngoài M11

- Wire Prisma + Redis cho identity/customer
- Google OAuth, JWT guards thay header
- Seed ~100 sản phẩm
- VNPay / GHN credential thật khi người dùng cung cấp
- Support / notification / reporting
- Catalog consumer cho `review.rating-aggregate.updated`
- OWASP 20 scenarios sau business xong
