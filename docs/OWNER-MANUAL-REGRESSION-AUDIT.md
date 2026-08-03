# Owner Manual Regression Audit

> **Updated:** 2026-08-03 · **Baseline:** `main` @ `359b8cf` · **No commit / no push**

## 1. Pre-flight (runtime truth)

| Check | Result |
| ----- | ------ |
| `git status` | Dirty working tree (pickup fix + docs); not committed |
| `git log -1` | `359b8cf feat: complete VN address, customer payments/reviews, and local acceptance` |
| Docker | 23 containers Up; **0 restart loops**; healthy after rebuild |
| PostgreSQL / Redis / RabbitMQ / MinIO | Connected |
| Kong / Swagger :8090 / Security Guide :3200 | Healthy / 200 |
| Nest 3001–3014 + storefront + admin | Healthy |

## 2. Previous acceptance vs owner manual test

| Claim (FUNCTIONAL-ACCEPTANCE 2026-08-02) | Owner saw | Gap |
| ---------------------------------------- | --------- | --- |
| Checkout pickup **PASS** | “Không có cửa hàng nhận hàng khả dụng.” | UI only; **Store count was 0** |
| Admin stores OK | `/cua-hang-kho` = HN-MAIN warehouse; no CRUD | Page listed warehouses only |
| Seed inventory | Warehouse stock only | No pickup store seed |
| e2e address-pickup PASS | Soft assertions | Did not require real store card |

## 3. Root cause — Store Pickup (confirmed + fixed)

1. **MISSING_DATA:** `Store` table was empty; only warehouse `HN-MAIN`.
2. **MISSING_CRUD:** Admin UI had no create/edit for stores; Staff/Admin saw no buttons because UI omitted them (not hide-only RBAC).
3. **Schema gap:** Store lacked `pickupEnabled`, `phone`, `openingHours`.
4. **Test realism:** Playwright did not require persisted pickup store / order create.
5. **HN-MAIN left as warehouse** (correct).

### Fixes applied this session

- Migration `20260803120000_store_pickup_fields` (ADD COLUMN only) — applied to live DB.
- `GET /api/v1/stores/pickup` filter: `isActive && pickupEnabled`.
- Admin `/cua-hang-kho` tabs Stores/Warehouses + CRUD (Manager+ UI; Manager+ API).
- Idempotent seed `pnpm seed:pickup-stores` → `HCM-NGUYEN-HUE`.
- Order validates pickup store via inventory before reserve.
- Storefront checkout cards show name/address/phone/hours; order detail hydrates store.
- e2e asserts real store name present.
- OpenAPI regenerate: **391 paths**, includes `/api/v1|v2/stores/pickup`, `openapi: 3.0.3`.

### Runtime evidence (post-fix)

| Check | Result |
| ----- | ------ |
| DB Store rows | HCM-NGUYEN-HUE active+pickup; HCM-OFF/HCM-INACT excluded from pickup |
| Direct + Kong pickup | 200 → `HCM-NGUYEN-HUE` |
| HN-MAIN | Unchanged warehouse |
| Staff POST store | **403 FORBIDDEN** |
| Restart inventory | Pickup store **persisted** |
| inventory-service tests | 15 passed |
| order-service tests | 40 passed |
| openapi:validate | PASSED |
| Browser checkout (no login) | Redirect/auth gate (password not on host) |
| Browser admin stores | 401 without session (expected) |

## 4. Full module classification (honest)

See `docs/FUNCTIONAL-ACCEPTANCE-REPORT.md` final matrix. Summary:

- **PASS_RUNTIME** only where DB/API/restart proven (pickup seed/API/filter/RBAC API).
- Auth/profile/checkout browser: **NOT_TESTED** without `DEV_SEED_PASSWORD` on host.
- Product images: **MISSING_DATA** (`mediaLinks=[]` on sampled product).
- Many modules: **PASS_API_ONLY** (health / 401 on protected routes) — not elevated to PASS.

## 5. Constraints honored

No `git reset --hard`, no volume wipe, no DB drop/truncate, no commit/push, intentional vulns remain always-on.
