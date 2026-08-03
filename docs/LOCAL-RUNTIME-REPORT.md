# LOCAL RUNTIME REPORT

> Probe **2026-08-03** — full runtime acceptance after Store Pickup checkpoint `8cf5c1b`.

## Compose health

| Component                           | Status  |
| ----------------------------------- | ------- |
| identity … reporting (14 Nest)      | healthy |
| storefront-web :3000                | healthy |
| admin-web :3100                     | healthy |
| kong :8000                          | healthy |
| swagger-portal :8090                | healthy |
| security-guide-portal :3200         | healthy |
| postgres / redis / rabbitmq / minio | healthy |
| Restart loops                       | **0**   |

## Rebuilds (this session)

| Image                               | Action                                      |
| ----------------------------------- | ------------------------------------------- |
| `nexatech/inventory-service:0.17.0` | rebuild + recreate (audit.recorded publish) |
| `nexatech/reporting-service:0.17.0` | rebuild + recreate (audit extract storeId)  |

## Smoke / acceptance results

| Check                                         | Result                                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/v1/stores/pickup` Kong+direct       | 200 `HCM-NGUYEN-HUE` (+ `HN-ACCEPT-01` after Admin create) |
| Staff POST store                              | **403**                                                    |
| Inventory stop/start                          | pickup stores **persisted**                                |
| Admin browser login Admin                     | **PASS_BROWSER**                                           |
| Admin store CRUD + HCM visible                | **PASS_BROWSER**                                           |
| Admin Nhật ký audit row                       | **PASS_BROWSER** (`inventory.store.updated`)               |
| Manager/Admin/SuperAdmin/Staff login e2e      | **PASS_BROWSER** (rbac-roles 5/5)                          |
| Customer1 COD pickup order                    | **PASS_BROWSER** (`NT-20260803-TCXQ8H` + follow-on e2e)    |
| Order detail store name/phone                 | **PASS_BROWSER**                                           |
| Cart clear + customer2 isolation              | **PASS_BROWSER**                                           |
| `pnpm address-data:validate`                  | PASS 34/3321                                               |
| `pnpm media:audit`                            | **PASS 10/10**                                             |
| `pnpm openapi:validate`                       | PASS 391 paths / 3.0.3                                     |
| format / lint / test / e2e / production build | **all exit 0**                                             |
| security:validate / test:secure / smoke       | **all exit 0**                                             |

## Notes

- Reporting EventConsumer needed restart after earlier Rabbit ECONNREFUSED at boot; after rebuild, consumer connects.
- Dev seed password reset locally this session (not committed). Owner should use own `DEV_SEED_PASSWORD`.
- Volumes not wiped; no `compose down -v`; no commit/push.
