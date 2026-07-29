# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M2 — Shared libraries và chuẩn nền tảng
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

| ID  | Milestone                                   | Trạng thái | Ghi chú                                 |
| --- | ------------------------------------------- | ---------- | --------------------------------------- |
| M0  | Kiểm tra môi trường và thiết kế kiến trúc   | ✅ Done    | Docs + version pin                      |
| M1  | Khởi tạo Nx monorepo                        | ✅ Done    | Nx 22.7.7 + TS strict + Jest            |
| M2  | Shared libraries và chuẩn nền tảng          | 🔄 Next    | contracts, errors, auth, config, events |
| M3  | Identity và customer                        | ⏳ Pending | Auth, OAuth, session Redis, RBAC        |
| M4  | Catalog, search và media                    | ⏳ Pending | Product/SKU/price + MinIO               |
| M5  | Inventory, warehouse và store               | ⏳ Pending | Reserve/deduct/release/transfer         |
| M6  | Cart, wishlist, comparison, recently viewed | ⏳ Pending | Guest merge                             |
| M7  | Order và fulfillment                        | ⏳ Pending | Split shipments, invoice PDF            |
| M8  | Payment: COD, mock, VNPay Sandbox           | ⏳ Pending | Adapter pattern                         |
| M9  | Shipping                                    | ⏳ Pending | Carrier + tracking                      |
| M10 | Review                                      | ⏳ Pending | Verified purchase + media               |
| M11 | Warranty và return                          | ⏳ Pending |                                         |
| M12 | Support ticket                              | ⏳ Pending |                                         |
| M13 | Notification email và in-app                | ⏳ Pending |                                         |
| M14 | Reporting và audit log                      | ⏳ Pending |                                         |
| M15 | Storefront UI                               | ⏳ Pending | Tiếng Việt                              |
| M16 | Admin Portal                                | ⏳ Pending | RBAC UI                                 |
| M17 | Seed ~100 sản phẩm                          | ⏳ Pending |                                         |
| M18 | Dockerfile và integration environment       | ⏳ Pending | Compose stack                           |
| M19 | Helm Chart production                       | ⏳ Pending | Kong routes                             |
| M20 | Unit, integration, API, Playwright, k6      | ⏳ Pending |                                         |
| M21 | 20 kịch bản OWASP API Security Top 10       | ⏳ Pending | docs/OWASP-SCENARIOS.md                 |
| M22 | Build Docker images sẵn sàng push Hub       | ⏳ Pending | Cần Docker Hub username                 |

## Công việc M0 đã hoàn thành

- [x] Đọc AGENTS.md, rules, README
- [x] Kiểm tra git/node/npm/pnpm/docker
- [x] Thiết kế kiến trúc tổng thể
- [x] Tạo roadmap milestone
- [x] Chốt dependency và version tương thích
- [x] Tạo bộ tài liệu bắt buộc trong `docs/`

## Công việc M1 đã hoàn thành

- [x] Nx integrated monorepo (pnpm) — **Nx 22.7.7**
- [x] TypeScript strict (`tsconfig.base.json`)
- [x] ESLint flat + Prettier
- [x] Jest unit test runner
- [x] Scripts: `format`, `lint`, `test`, `build`, `typecheck`
- [x] Library mẫu `@nexatech/shared-platform` (ID, pagination, correlation headers)
- [x] `pnpm format|lint|test|build` đều xanh
- [x] Ghi nhận ADR-018 (bypass Nx native cache trên Windows)

## Công việc tiếp theo (M2)

- [ ] `libs/shared/errors` — error envelope thống nhất
- [ ] `libs/shared/config` — Zod env schema
- [ ] `libs/shared/auth` — JWT claims + RBAC
- [ ] `libs/shared/contracts` — API DTO/types
- [ ] `libs/shared/events` — event envelope + routing keys
- [ ] `libs/shared/logging` — requestId/traceId helpers
- [ ] Unit tests + lint + build xanh
- [ ] Commit M2

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

- Workspace gần như trống (README, AGENTS, rules, gitignore).
- Môi trường local đủ điều kiện để khởi tạo monorepo.
- Đã viết đầy đủ docs kiến trúc, quyết định kỹ thuật, contract, DB, events, deploy, testing, OWASP skeleton.

### 2026-07-29 — M1

- Nx 23.1.0 lỗi native `WorkspaceContext` trên máy này → pin **Nx 22.7.7**.
- Monorepo: `apps/`, `libs/shared/platform`, ESLint/Prettier/Jest, scripts chuẩn.
- Verify: format, lint, 5 unit tests, build — pass.
