# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M3 — Identity và customer
- **Cập nhật lần cuối:** 2026-07-29
- **Môi trường:** Đạt yêu cầu (git, node, npm, pnpm, docker)

## Kiểm tra môi trường (M0)

| Công cụ        | Phiên bản        | Kết quả |
| -------------- | ---------------- | ------- |
| Git            | 2.55.0.windows.3 | OK      |
| Node.js        | v24.18.0         | OK      |
| npm            | 11.16.0          | OK      |
| pnpm           | 10.34.5          | OK      |
| Docker         | 29.6.2           | OK      |
| Docker Compose | v5.3.1           | OK      |

## Roadmap milestone

| ID  | Milestone                                   | Trạng thái | Ghi chú                                     |
| --- | ------------------------------------------- | ---------- | ------------------------------------------- |
| M0  | Kiểm tra môi trường và thiết kế kiến trúc   | ✅ Done    | Docs + version pin                          |
| M1  | Khởi tạo Nx monorepo                        | ✅ Done    | Nx 22.7.7 + TS strict + Jest                |
| M2  | Shared libraries và chuẩn nền tảng          | ✅ Done    | errors/config/auth/contracts/events/logging |
| M3  | Identity và customer                        | 🔄 Next    | Auth, OAuth, session Redis, RBAC            |
| M4  | Catalog, search và media                    | ⏳ Pending | Product/SKU/price + MinIO                   |
| M5  | Inventory, warehouse và store               | ⏳ Pending | Reserve/deduct/release/transfer             |
| M6  | Cart, wishlist, comparison, recently viewed | ⏳ Pending | Guest merge                                 |
| M7  | Order và fulfillment                        | ⏳ Pending | Split shipments, invoice PDF                |
| M8  | Payment: COD, mock, VNPay Sandbox           | ⏳ Pending | Adapter pattern                             |
| M9  | Shipping                                    | ⏳ Pending | Carrier + tracking                          |
| M10 | Review                                      | ⏳ Pending | Verified purchase + media                   |
| M11 | Warranty và return                          | ⏳ Pending |                                             |
| M12 | Support ticket                              | ⏳ Pending |                                             |
| M13 | Notification email và in-app                | ⏳ Pending |                                             |
| M14 | Reporting và audit log                      | ⏳ Pending |                                             |
| M15 | Storefront UI                               | ⏳ Pending | Tiếng Việt                                  |
| M16 | Admin Portal                                | ⏳ Pending | RBAC UI                                     |
| M17 | Seed ~100 sản phẩm                          | ⏳ Pending |                                             |
| M18 | Dockerfile và integration environment       | ⏳ Pending | Compose stack                               |
| M19 | Helm Chart production                       | ⏳ Pending | Kong routes                                 |
| M20 | Unit, integration, API, Playwright, k6      | ⏳ Pending |                                             |
| M21 | 20 kịch bản OWASP API Security Top 10       | ⏳ Pending | docs/OWASP-SCENARIOS.md                     |
| M22 | Build Docker images sẵn sàng push Hub       | ⏳ Pending | Cần Docker Hub username                     |

## Công việc M2 đã hoàn thành

- [x] `@nexatech/shared-errors` — AppError + error envelope
- [x] `@nexatech/shared-config` — Zod env schema
- [x] `@nexatech/shared-auth` — RBAC roles/rank helpers
- [x] `@nexatech/shared-contracts` — pagination, health, auth DTOs, categories
- [x] `@nexatech/shared-events` — event envelope + routing keys
- [x] `@nexatech/shared-logging` — structured logger + correlation
- [x] Unit tests (20 tests tổng) + lint + build xanh

## Công việc tiếp theo (M3)

- [ ] NestJS `identity-service` với Prisma + PostgreSQL schema
- [ ] Register/login/email verify/forgot password/OTP
- [ ] JWT access + refresh/session Redis
- [ ] Google OAuth adapter (config-driven)
- [ ] Device/session management + RBAC
- [ ] NestJS `customer-service` profile/addresses
- [ ] Health/Swagger/API v1+v2
- [ ] Unit + integration tests
- [ ] Commit M3

## Blockers cần người dùng (chưa cần ngay)

- Docker Hub username/token (M22)
- Gmail App Password (notification)
- Google OAuth Client ID/Secret (identity)
- VNPay Sandbox credentials (payment)
- API vận chuyển (shipping)
- Domain/certificate/IP hạ tầng (deploy prod)
- Email Super Admin khởi tạo

## Nhật ký

### 2026-07-29 — M0

- Workspace gần như trống; môi trường đạt yêu cầu; docs đầy đủ.

### 2026-07-29 — M1

- Nx 23.1.0 lỗi native cache → pin **Nx 22.7.7**.
- Monorepo + `@nexatech/shared-platform` + pipeline xanh.

### 2026-07-29 — M2

- 6 shared libraries nền tảng với business logic thật và tests.
- format/lint/test/build pass.
