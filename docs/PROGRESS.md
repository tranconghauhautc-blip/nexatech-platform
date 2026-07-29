# NexaTech Progress

## Trạng thái hiện tại

- **Milestone tiếp theo:** M5 — Inventory (nhiều kho, giữ/trừ/hoàn tồn)
- **Milestone đã hoàn thành gần nhất:** M4
- **Cập nhật lần cuối:** 2026-07-29
- **Branch:** `main`
- **Kiểm tra cuối phiên:** `pnpm format` / `pnpm lint` / `pnpm test` / `pnpm build` — xanh

## Roadmap milestone

| ID     | Milestone                                 | Trạng thái  | Ghi chú                          |
| ------ | ----------------------------------------- | ----------- | -------------------------------- |
| M0     | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done     | Docs + env check                 |
| M1     | Khởi tạo Nx monorepo                      | ✅ Done     | Nx **22.7.7** + TS strict + Jest |
| M2     | Shared libraries và chuẩn nền tảng        | ✅ Done     | 7 shared libs                    |
| M3     | Identity và customer                      | ✅ Done     | Auth flows + customer profile    |
| M4     | Catalog, search và media                  | ✅ Done     | Prisma + FTS + MinIO             |
| M5     | Inventory                                 | ⏳ **Next** | Xem `docs/HANDOFF-M5.md`         |
| M6–M22 | …                                         | ⏳ Pending  | Roadmap gốc                      |

## Commits cục bộ liên quan

| Commit    | Nội dung                                               |
| --------- | ------------------------------------------------------ |
| `9cee965` | M0 docs architecture/roadmap                           |
| `fad8cdb` | M1 Nx monorepo                                         |
| `8df1332` | M2 shared libraries                                    |
| `d40b758` | M3 identity + customer                                 |
| `8703fa2` | Handoff chuẩn bị M4                                    |
| _(M4)_    | `feat(m4): add catalog and media services with Prisma` |

## Apps sau M4 (11 projects)

| App              | Port | Persistence            |
| ---------------- | ---- | ---------------------- |
| identity-service | 3001 | In-memory (schema sẵn) |
| customer-service | 3002 | In-memory (schema sẵn) |
| catalog-service  | 3003 | Prisma + Postgres FTS  |
| media-service    | 3004 | Prisma + MinIO         |

## M4 đã hoàn thành

- [x] `catalog-service`: category tree, brand, spec template, product, SKU, price history, media link, FTS search/filter/sort/pagination, recommendations, audit events, RBAC Staff+
- [x] `media-service`: presign upload/download, MIME/size validation, safe object key, ownership, links, orphan cleanup, audit, MinIO adapter
- [x] Prisma migrations committed (không db push / không migrate reset)
- [x] Compose: Postgres 16, Redis, RabbitMQ, MinIO + bucket init
- [x] Unit + repository integration + API smoke + migration + MinIO integration tests
- [x] format / lint / test / build xanh
- [x] Docs + HANDOFF-M5

## Workaround bắt buộc (Windows)

1. **Nx = 22.7.7**
2. `NX_SKIP_NATIVE_FILE_CACHE=true` + `NX_DAEMON=false`
3. Không `Set-Content -Encoding utf8` (BOM)

## Local infra

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
# copy .env.example → .env
cd apps/catalog-service && npx prisma migrate deploy && npx prisma generate
cd ../media-service && npx prisma migrate deploy && npx prisma generate
```

## Blockers cần người dùng (chưa chặn M5)

- Docker Hub / Gmail / Google OAuth / VNPay / shipping API / domain / Super Admin email

## Nhật ký

### 2026-07-29 — M4 done

- catalog-service + media-service với Prisma repository thật.
- Integration tests chạy xanh với Compose local.
- Handoff M5 sẵn sàng; **không bắt đầu M5 trong phiên này**.
