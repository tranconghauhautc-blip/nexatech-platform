# Handoff — Chuẩn bị M4 (Catalog + Media)

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M4 trong phiên tạo file này.**

Ngày bàn giao: **2026-07-29**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                                |
| -------------- | ------------------------------------------------------ |
| Path           | `d:\NexaTech\nexatech-platform`                        |
| Branch         | `main`                                                 |
| Remote         | Ahead of `origin/main` (commits local M0–M3 + handoff) |
| Working tree   | Clean sau commit handoff                               |
| Milestone xong | M0, M1, M2, M3                                         |
| Milestone tiếp | **M4** — chưa tạo `catalog-service` / `media-service`  |

### Commits chính

1. `9cee965` — docs M0
2. `fad8cdb` — Nx monorepo M1
3. `8df1332` — shared libs M2
4. `d40b758` — identity + customer M3
5. Handoff commit — `chore: prepare handoff for catalog and media milestone`

### Projects Nx hiện có (9)

- Libs: `shared-platform`, `shared-errors`, `shared-config`, `shared-auth`, `shared-contracts`, `shared-events`, `shared-logging`
- Apps: `identity-service`, `customer-service`

---

## 2. Dependency và phiên bản đang dùng

Khóa trong `package.json` / `pnpm-lock.yaml`:

| Package                             | Version                         |
| ----------------------------------- | ------------------------------- |
| Node engines                        | `>=22` (local đã chạy 24.18.0)  |
| pnpm                                | `10.34.5` (`packageManager`)    |
| **nx / @nx/\***                     | **22.7.7**                      |
| typescript                          | 5.8.3                           |
| nestjs common/core/platform-express | 11.0.12                         |
| @nestjs/swagger                     | 11.1.1                          |
| @nestjs/config                      | 4.0.2                           |
| prisma / @prisma/client             | 6.5.0                           |
| zod                                 | 3.24.2                          |
| jest                                | 29.7.0                          |
| bcryptjs                            | 3.0.2                           |
| jsonwebtoken                        | 9.0.2                           |
| ioredis                             | 5.6.0 (chưa dùng trong service) |

Compose images (dev): Postgres `16.8-alpine`, Redis `7.4-alpine`, RabbitMQ `3.13-management-alpine`, MinIO release pin trong `infra/docker/docker-compose.dev.yml`.

---

## 3. Cách chạy lint / test / build

Từ root workspace:

```bash
pnpm install
pnpm format
pnpm lint
pnpm test
pnpm build
```

Hoặc tương đương Nx (nhớ env):

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
pnpm exec nx run-many -t lint --all
pnpm exec nx run-many -t test --all
pnpm exec nx run-many -t build --all
```

### Workaround Windows (bắt buộc)

- **Không nâng Nx lên 23.x** trên máy này (lỗi `WorkspaceContext is not a constructor`).
- Luôn có `NX_SKIP_NATIVE_FILE_CACHE=true` và `NX_DAEMON=false` (đã gắn `package.json` scripts + `.env.nx`).
- Tránh PowerShell `Set-Content -Encoding utf8` (BOM làm vỡ `project.json`).

Infra local (khi cần DB/Redis/MinIO):

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Copy `.env.example` → `.env` (không commit `.env`).

Serve (sau M3):

```bash
pnpm exec nx serve identity-service
pnpm exec nx serve customer-service
```

- Identity: `http://localhost:3001/docs`, health `/health`
- Customer: `http://localhost:3002/docs`

---

## 4. Kiến trúc persistence hiện tại

```text
┌─────────────────────┐     ┌──────────────────────┐
│ identity-service    │     │ customer-service     │
│ AuthService         │     │ CustomerService      │
│        │            │     │        │             │
│ InMemoryIdentityStore│     │ InMemoryCustomerStore│
└─────────────────────┘     └──────────────────────┘
          ▲                            ▲
          │ interface                  │ interface
          │ (chưa wire)                │ (chưa wire)
┌─────────┴──────────┐     ┌──────────┴───────────┐
│ Prisma schema      │     │ Prisma schema        │
│ nexatech_identity  │     │ nexatech_customer    │
└────────────────────┘     └──────────────────────┘
```

- **Production path mục tiêu:** Prisma + Postgres per service; session/OTP trên Redis.
- **Hiện tại:** In-memory đủ để unit test auth/customer; Prisma schema + Compose init SQL đã chuẩn bị.
- **Chưa có:** migration folders, `prisma generate` trong CI/build app, Redis client usage.

Pattern cần tái sử dụng ở M4: `XxxStore` interface + `InMemoryXxxStore` + Prisma schema file cạnh app.

---

## 5. Yêu cầu triển khai M4

### 5.1 Tạo apps

- `apps/catalog-service` — NestJS (generator `@nx/nest:application`), port đề xuất `3003`
- `apps/media-service` — NestJS, port đề xuất `3004`
- Tags: `scope:backend`, `type:service`
- Giống identity: versioning URI v1/v2, Swagger `/docs`, health exclude prefix, webpack build

### 5.2 catalog-service (business thật, không placeholder rỗng)

- Danh mục đúng scope: điện thoại, laptop, tablet, đồng hồ thông minh, tai nghe/loa, phụ kiện (dùng `CATEGORY_SLUGS` từ `@nexatech/shared-contracts`)
- Brand, Product (slug), Variant/SKU, thuộc tính động, giá + **price history**
- Public search/filter (query + pagination shared contracts)
- Recommendations **rule-based** (ví dụ cùng brand/category)
- Admin CRUD (Staff+) — có thể stub guard tạm giống customer header hoặc role check từ shared-auth
- Prisma schema `nexatech_catalog` + in-memory store cho unit tests
- Events: `catalog.product_updated`, `catalog.price_changed` (emit helper từ `@nexatech/shared-events` — có thể no-op publisher tạm)

### 5.3 media-service

- Presigned upload URL MinIO (`MINIO_*` env, không hard-code secret)
- Metadata DB `nexatech_media`
- Buckets: bắt đầu với `product-media`
- Validate content-type/size (chuẩn bị OWASP sau)
- Compose MinIO đã có trong `infra/docker/docker-compose.dev.yml`

### 5.4 Definition of Done M4

1. Cập nhật `docs/PROGRESS.md`
2. Code + unit tests thật
3. `pnpm format && pnpm lint && pnpm test && pnpm build` xanh
4. Cập nhật API-CONTRACTS / DATABASES
5. Commit local message rõ (ví dụ `feat(m4): add catalog and media services`)
6. **Không** bắt đầu M5 trong cùng PR/commit nếu chưa xong DoD M4

---

## 6. Ràng buộc không được thay đổi

- Phạm vi sản phẩm: **không** voucher / mã giảm / flash sale / SIM / thiết bị mạng / gia dụng
- Stack: Nx integrated + pnpm + TS strict + Nest + Prisma + Postgres 16 + Redis + RabbitMQ + MinIO
- API `/api/v1` và `/api/v2`
- Error envelope + correlation headers shared
- Không hard-code secret/IP/domain; dùng env + schema
- Không commit `.env`
- Không `prisma migrate reset` / DROP DATABASE / force push / prune volumes
- Không dùng Docker tag `latest`
- Không dùng DB user `postgres` cho app
- Giữ **Nx 22.7.7** + native cache bypass trừ khi có xác nhận nâng cấp an toàn
- Không tạo hàng loạt placeholder không có business logic

---

## 7. File cần đọc đầu tiên (Agent mới)

Theo thứ tự:

1. `docs/HANDOFF-M4.md` (file này)
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md` (đặc biệt ADR-017, ADR-018, ADR-019–022)
4. `AGENTS.md` + `.cursor/rules/00-nexatech.mdc`
5. `docs/ARCHITECTURE.md`
6. `docs/API-CONTRACTS.md` (phần catalog/media kế hoạch + identity/customer thực tế)
7. `docs/DATABASES.md`
8. `docs/EVENTS.md`
9. Pattern tham chiếu code:
   - `apps/identity-service/src/app/auth/*`
   - `apps/customer-service/src/app/customer/*`
   - `apps/identity-service/src/main.ts`
10. Shared:
    - `libs/shared/contracts/src/lib/shared-contracts.ts` (`CATEGORY_SLUGS`, pagination)
    - `libs/shared/errors`, `libs/shared/events`, `libs/shared/auth`
11. Infra: `infra/docker/docker-compose.dev.yml`, `.env.example`
12. Root: `package.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`

---

## 8. Việc dang dở ngoài scope M4 (nhắc để không quên)

- Wire Prisma + Redis cho identity/customer
- Google OAuth
- JWT guards thay `x-user-id`
- Preference API customer
- Admin identity APIs

Có thể làm song song sau M4 hoặc xen kẽ khi chạm auth — **ưu tiên M4 catalog/media trước** theo roadmap.
