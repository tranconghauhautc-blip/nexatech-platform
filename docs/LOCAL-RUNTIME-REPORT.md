# LOCAL RUNTIME REPORT

> Probe **2026-08-03** — owner manual regression (Store Pickup fix).

## Compose health

| Component | Status |
| --------- | ------ |
| identity … reporting (14 Nest) | healthy |
| storefront-web :3000 | healthy (rebuilt) |
| admin-web :3100 | healthy (rebuilt) |
| kong :8000 | healthy |
| swagger-portal :8090 | healthy |
| security-guide-portal :3200 | healthy |
| postgres / redis / rabbitmq / minio | healthy |
| Restart loops | **0** |

## Rebuilds (this session)

| Image | Action |
| ----- | ------ |
| `nexatech/inventory-service:0.17.0` | build + recreate |
| `nexatech/order-service:0.17.0` | build + recreate |
| `nexatech/admin-web:0.17.0` | build + recreate (×2) |
| `nexatech/storefront-web:0.17.0` | build + recreate (×2) |

## Smoke results

| Check | Result |
| ----- | ------ |
| `GET /api/v1/stores` | 200 (3 rows incl inactive test stores) |
| `GET /api/v1/stores/pickup` direct+Kong | 200 `HCM-NGUYEN-HUE` only |
| `GET /api/v1/warehouses` | 200 `HN-MAIN` |
| Staff POST store | **403** |
| Inventory stop/start | pickup store persisted |
| `pnpm address-data:validate` | PASS 34/3321 |
| `pnpm media:audit` | PASS (8/10 sampled with media) |
| `pnpm openapi:validate` | PASS 391 paths / 3.0.3 |
| Customer/admin login browser | **NOT_TESTED** — no host `DEV_SEED_PASSWORD` |

## Notes

- Non-destructive migration `20260803120000_store_pickup_fields` applied.
- Seed: `pnpm seed:pickup-stores` with `NEXATECH_ALLOW_DEV_SEED=YES`.
- Volumes not wiped; no `compose down -v`.
