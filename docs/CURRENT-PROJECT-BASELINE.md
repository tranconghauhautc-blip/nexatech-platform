# CURRENT PROJECT BASELINE

> Re-baselined **2026-08-03** after owner manual regression (Store Pickup). Prefer this over older snapshots.
> **No commit in this phase** (owner review gate).

## 1. HEAD / branch / working tree

| Item | Value |
| ---- | ----- |
| Branch | `main` |
| HEAD | `359b8cf` — VN address, customer payments/reviews, local acceptance |
| Working tree | **Dirty** — pickup store CRUD/seed/OpenAPI/docs (uncommitted) |
| Remote | `origin/main` was synced at session start |

## 2. Frontend / backends / infra

Unchanged port map (storefront 3000, admin 3100, Nest 3001–3014, Kong 8000, Swagger 8090, Security Guide 3200, Postgres/Redis/Rabbit/MinIO).

**Runtime 2026-08-03:** all services healthy; rebuilt `inventory-service`, `order-service`, `admin-web`, `storefront-web`.

## 3. OpenAPI

| Item | State |
| ---- | ----- |
| Version | **3.0.3** |
| Combined | ~**391 paths** (includes `/api/v1/stores/pickup`) |
| Scripts | generate / combine / validate **PASSED** this session |

## 4. Seed commands

| Command | Purpose |
| ------- | ------- |
| `pnpm seed:accounts` | Staff/Manager/Admin/SuperAdmin |
| `pnpm seed:customers` | customer1 / customer2 |
| `pnpm seed:catalog` | ~100 products |
| `pnpm seed:inventory` | Stock + invokes pickup seed |
| `pnpm seed:pickup-stores` | Idempotent `HCM-NGUYEN-HUE` pickup store |

## 5. Verified root causes (updated)

| Symptom | Root cause | Fix status |
| ------- | ---------- | ---------- |
| Checkout “không có cửa hàng” | Store table empty; seed only warehouse HN-MAIN | **Fixed** — seed + migration pickup fields |
| Admin no create store | `/cua-hang-kho` warehouses-only UI | **Fixed** — store/warehouse CRUD Manager+ |
| Prior pickup PASS | e2e soft UI checks | **Hardened** e2e requires store name |
| Product media empty on some PDP | Sampled slug had `mediaLinks=[]`; audit 8/10 with media | **PARTIAL** — re-import if needed |
| Auth browser this pass | No host `DEV_SEED_PASSWORD` | **Blocker for browser** — set env to finish |

## 6. Related docs

- `docs/OWNER-MANUAL-REGRESSION-AUDIT.md`
- `docs/OWNER-MANUAL-TEST-CHECKLIST.md`
- `docs/FUNCTIONAL-ACCEPTANCE-REPORT.md`
