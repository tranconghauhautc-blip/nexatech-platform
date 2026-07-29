# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M4 — Catalog, search và media
- **Cập nhật lần cuối:** 2026-07-29
- **Môi trường:** Đạt yêu cầu

## Roadmap milestone

| ID  | Milestone                                   | Trạng thái | Ghi chú                       |
| --- | ------------------------------------------- | ---------- | ----------------------------- |
| M0  | Kiểm tra môi trường và thiết kế kiến trúc   | ✅ Done    | Docs + version pin            |
| M1  | Khởi tạo Nx monorepo                        | ✅ Done    | Nx 22.7.7 + TS strict + Jest  |
| M2  | Shared libraries và chuẩn nền tảng          | ✅ Done    | 6 shared libs                 |
| M3  | Identity và customer                        | ✅ Done    | Auth flows + customer profile |
| M4  | Catalog, search và media                    | 🔄 Next    | Product/SKU/price + MinIO     |
| M5  | Inventory, warehouse và store               | ⏳ Pending |                               |
| M6  | Cart, wishlist, comparison, recently viewed | ⏳ Pending |                               |
| M7  | Order và fulfillment                        | ⏳ Pending |                               |
| M8  | Payment: COD, mock, VNPay Sandbox           | ⏳ Pending |                               |
| M9  | Shipping                                    | ⏳ Pending |                               |
| M10 | Review                                      | ⏳ Pending |                               |
| M11 | Warranty và return                          | ⏳ Pending |                               |
| M12 | Support ticket                              | ⏳ Pending |                               |
| M13 | Notification email và in-app                | ⏳ Pending |                               |
| M14 | Reporting và audit log                      | ⏳ Pending |                               |
| M15 | Storefront UI                               | ⏳ Pending |                               |
| M16 | Admin Portal                                | ⏳ Pending |                               |
| M17 | Seed ~100 sản phẩm                          | ⏳ Pending |                               |
| M18 | Dockerfile và integration environment       | ⏳ Pending |                               |
| M19 | Helm Chart production                       | ⏳ Pending |                               |
| M20 | Unit, integration, API, Playwright, k6      | ⏳ Pending |                               |
| M21 | 20 kịch bản OWASP API Security Top 10       | ⏳ Pending |                               |
| M22 | Build Docker images sẵn sàng push Hub       | ⏳ Pending | Cần Docker Hub username       |

## Công việc M3 đã hoàn thành

- [x] NestJS `identity-service` + `customer-service`
- [x] Auth: register, verify email OTP, login, refresh, logout, forgot/reset password
- [x] JWT access + refresh session (hash lưu store; revoke khi refresh/reset)
- [x] RBAC roles trên token claims
- [x] Customer profile + địa chỉ
- [x] API versioning `/api/v1` & `/api/v2`, Swagger, health endpoints
- [x] Prisma schemas cho identity & customer
- [x] Docker Compose dev: Postgres 16, Redis, RabbitMQ, MinIO
- [x] `.env.example`
- [x] Unit tests auth/customer + lint/build xanh

### Ghi chú kỹ thuật M3

- Runtime hiện dùng **InMemory store** để unit test/build độc lập DB.
- Prisma schema đã sẵn; wiring Prisma repository + Redis session persistence sẽ gắn khi chạy migrate trên Compose (tiếp tục tinh chỉnh ở M18 nếu cần).
- Google OAuth chờ Client ID/Secret từ người dùng; endpoint có thể bổ sung adapter khi có credential.

## Công việc tiếp theo (M4)

- [ ] `catalog-service`: category/brand/product/SKU/price history
- [ ] Search/filter + recommendations rule-based
- [ ] `media-service`: MinIO presign
- [ ] Tests + commit M4

## Blockers cần người dùng (chưa cần ngay)

- Docker Hub username/token (M22)
- Gmail App Password (notification)
- Google OAuth Client ID/Secret (identity)
- VNPay Sandbox credentials (payment)
- API vận chuyển (shipping)
- Domain/certificate/IP hạ tầng
- Email Super Admin

## Nhật ký

### 2026-07-29 — M0–M2

- Docs, Nx 22.7.7 monorepo, shared libraries — hoàn tất.

### 2026-07-29 — M3

- identity-service + customer-service NestJS với business auth/customer thật.
- format/lint/test/build pass (9 projects).
