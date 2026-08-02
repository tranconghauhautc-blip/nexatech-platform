# LOCAL RUNTIME REPORT

> Probe **2026-08-02** — final acceptance continuation.

## Compose health

| Component | Status |
| --------- | ------ |
| identity … reporting (14 Nest) | healthy |
| storefront-web :3000 | healthy |
| admin-web :3100 | healthy |
| kong :8000 | healthy |
| swagger-portal :8090 | healthy (rebuilt this pass) |
| security-guide-portal :3200 | healthy |
| postgres / redis / rabbitmq / minio | healthy |
| minio-init | exited (one-shot OK) |

## Rebuilds (this continuation)

| Image | Action | Evidence |
| ----- | ------ | -------- |
| `nexatech/swagger-portal:0.17.0` | build + force-recreate | OpenAPI combined baked in |
| Prior session images | payment, catalog, review, customer, storefront, admin, order | already healthy `:0.17.0` |

## Smoke results

| Check | Result |
| ----- | ------ |
| `GET /payments/me` unauth | 401 |
| `GET /payments/me` customer1 | **200** (sample COD payment) |
| `GET /payments/me` customer2 | **200** `[]` / no overlap |
| `GET /reviews/me` auth | **200** |
| Catalog minPrice | real VND |
| `pnpm lab:smoke` | PASSED |
| `pnpm media:audit` | PASSED |
| `pnpm media:e2e` | PASSED (presign→MinIO via network→confirm→link) |
| `pnpm checkout:smoke` | PASSED |

## Notes

- Seed passwords are operator-defined (`DEV_SEED_PASSWORD`); reset with `DEV_SEED_RESET_PASSWORD=YES` for local Playwright.
- Next.js local `nx build` for admin/storefront requires `NODE_ENV=production` (development env triggers Pages `/404` Html bug).
