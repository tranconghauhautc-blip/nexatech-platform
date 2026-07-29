# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M4 — Catalog, search và media (**chưa bắt đầu**)
- **Milestone đã hoàn thành gần nhất:** M3
- **Cập nhật lần cuối:** 2026-07-29 (handoff)
- **Branch:** `main` (local commits, chưa yêu cầu push)
- **Kiểm tra cuối phiên:** `pnpm format` / `pnpm lint` / `pnpm test` / `pnpm build` — xanh

## Roadmap milestone

| ID     | Milestone                                 | Trạng thái  | Ghi chú                          |
| ------ | ----------------------------------------- | ----------- | -------------------------------- |
| M0     | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done     | Docs + env check                 |
| M1     | Khởi tạo Nx monorepo                      | ✅ Done     | Nx **22.7.7** + TS strict + Jest |
| M2     | Shared libraries và chuẩn nền tảng        | ✅ Done     | 7 shared libs (kể cả platform)   |
| M3     | Identity và customer                      | ✅ Done     | Auth flows + customer profile    |
| M4     | Catalog, search và media                  | ⏳ **Next** | Chưa tạo app                     |
| M5–M22 | …                                         | ⏳ Pending  | Xem roadmap gốc                  |

## Commits cục bộ liên quan

| Commit      | Nội dung                                                 |
| ----------- | -------------------------------------------------------- |
| `9cee965`   | M0 docs architecture/roadmap                             |
| `fad8cdb`   | M1 Nx monorepo                                           |
| `8df1332`   | M2 shared libraries                                      |
| `d40b758`   | M3 identity + customer                                   |
| _(handoff)_ | `chore: prepare handoff for catalog and media milestone` |

## File / module đã tạo

### Docs

- `docs/ARCHITECTURE.md`, `PROGRESS.md`, `DECISIONS.md`, `API-CONTRACTS.md`, `DATABASES.md`, `EVENTS.md`, `DEPLOYMENT.md`, `TESTING.md`, `OWASP-SCENARIOS.md`
- `docs/HANDOFF-M4.md` (bàn giao phiên này)

### Monorepo root

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`, `tsconfig.json`
- `eslint.config.mjs`, `jest.config.ts`, `jest.preset.js`, `.prettierrc`, `.prettierignore`, `.env.nx`, `.env.example`

### Shared libraries (`libs/shared/*`)

| Package                      | Path                    | Vai trò                                     |
| ---------------------------- | ----------------------- | ------------------------------------------- |
| `@nexatech/shared-platform`  | `libs/shared/platform`  | ID, pagination helpers, correlation headers |
| `@nexatech/shared-errors`    | `libs/shared/errors`    | `AppError`, error envelope                  |
| `@nexatech/shared-config`    | `libs/shared/config`    | Zod env loading                             |
| `@nexatech/shared-auth`      | `libs/shared/auth`      | RBAC roles/rank                             |
| `@nexatech/shared-contracts` | `libs/shared/contracts` | Pagination, health, auth DTOs, categories   |
| `@nexatech/shared-events`    | `libs/shared/events`    | Event envelope + routing keys               |
| `@nexatech/shared-logging`   | `libs/shared/logging`   | Structured logger + correlation             |

### Apps

| App                | Path                    | Module chính                                                                                    |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `identity-service` | `apps/identity-service` | `AuthModule`, `AuthService`, `InMemoryIdentityStore`, `HealthController`, Prisma schema         |
| `customer-service` | `apps/customer-service` | `CustomerModule`, `CustomerService`, `InMemoryCustomerStore`, `HealthController`, Prisma schema |

### Infra

- `infra/docker/docker-compose.dev.yml` — Postgres 16, Redis 7, RabbitMQ, MinIO
- `infra/docker/postgres/init-databases.sql` — DB + app users `nexatech_identity`, `nexatech_customer`

## Lệnh đã chạy (xanh)

```bash
pnpm format
pnpm lint    # 9 projects
pnpm test    # 9 projects (~24 unit tests)
pnpm build   # 7 libs (tsc) + 2 Nest apps (webpack)
```

Scripts luôn set:

```text
NX_SKIP_NATIVE_FILE_CACHE=true
NX_DAEMON=false
```

qua `cross-env` trong `package.json` và file `.env.nx`.

## Lỗi đã xử lý

| Vấn đề                                                                       | Cách xử lý                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `create-nx-workspace@23.1.0` → `WorkspaceContext is not a constructor`       | Pin **Nx 22.7.7**; không dùng Nx 23 trên máy này                 |
| Nx native binding / `nx report` treo                                         | `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`              |
| pnpm bỏ qua build script `nx` / `@swc/core` / prisma                         | `onlyBuiltDependencies` trong `pnpm-workspace.yaml`              |
| PowerShell `Set-Content -Encoding utf8` ghi **BOM** → Nx graph fail          | Ghi lại JSON/TS bằng Node không BOM                              |
| Jest `outDir` / ts-jest fail                                                 | `isolatedModules: true` + `outDir` rõ trong `tsconfig.spec.json` |
| TS4111 `noPropertyAccessFromIndexSignature` trên `process.env` / JWT payload | Dùng `process.env['KEY']`, `payload['sid']`                      |
| Nest build webpack path aliases                                              | Dùng `tsconfig.base.json` paths `@nexatech/*`                    |

## Workaround bắt buộc (Windows hiện tại)

1. **Nx = 22.7.7** (không nâng 23.x trừ khi xác nhận native cache ổn).
2. Mọi lệnh Nx qua scripts hoặc:

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
```

3. Không tạo file JSON/config bằng PowerShell `Set-Content -Encoding utf8` (BOM).

## Công việc còn dang dở (trước / trong M3–M4)

- [ ] Prisma repository thật thay `InMemory*Store` (schema đã có, chưa `migrate` / generate client wired)
- [ ] Redis session/OTP persistence (Compose có Redis; runtime chưa dùng `ioredis`)
- [ ] Google OAuth adapter (chờ Client ID/Secret)
- [ ] JWT guard trên customer endpoints (hiện dùng header `x-user-id` tạm)
- [ ] Admin user/RBAC management APIs
- [ ] Preference CRUD customer
- [ ] `catalog-service` + `media-service` (**M4 — chưa tạo**)
- [ ] Initial Prisma migrations SQL committed + migrate job

## Milestone tiếp theo — M4

Xem chi tiết triển khai tại `docs/HANDOFF-M4.md`.

Tóm tắt:

1. Tạo NestJS `catalog-service` và `media-service` theo pattern identity/customer.
2. Catalog: category/brand/product/SKU/price history + search/filter + recommendations rule-based.
3. Media: MinIO presign + metadata DB.
4. Prisma schemas + in-memory (hoặc Prisma) cho unit test độc lập.
5. format / lint / test / build / commit M4.

## Blockers cần người dùng (chưa chặn M4)

- Docker Hub username/token (M22)
- Gmail App Password (notification)
- Google OAuth Client ID/Secret (identity)
- VNPay Sandbox (payment)
- API vận chuyển (shipping)
- Domain / certificate / IP
- Email Super Admin

## Nhật ký

### 2026-07-29 — M0–M3

- Hoàn tất nền tảng monorepo, shared libs, identity + customer.
- Handoff chuẩn bị M4; **không bắt đầu code M4 trong phiên này**.
