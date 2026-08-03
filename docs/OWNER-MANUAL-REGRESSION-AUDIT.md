# Owner Manual Regression Audit

> **Updated:** 2026-08-03 · **Checkpoint:** `fix/full-runtime-acceptance` @ `8cf5c1b` · **No commit / no push this phase**

## 1. Pre-flight (runtime truth)

| Check | Result |
| ----- | ------ |
| `git log -1` | `8cf5c1b fix: restore store pickup with CRUD, seed, and runtime filtering` |
| Working tree | Dirty after audit projection + media:audit + pickup COD e2e + docs |
| Docker | 23 containers Up; **0 restart loops**; healthy after rebuilds |
| PostgreSQL / Redis / RabbitMQ / MinIO | Connected |
| Kong / Swagger :8090 / Security Guide :3200 | Healthy |

## 2. Store Pickup — closed

| Gap (owner manual) | Fix evidence |
| ------------------ | ------------ |
| Empty Store table | Seed + Admin create; HCM-NGUYEN-HUE + HN-ACCEPT-01 |
| No Admin CRUD | Browser Admin create/edit/disable/re-enable |
| Soft e2e | Hardened pickup assertions + dedicated COD acceptance e2e **PASS** |
| Audit not in Admin UI | Inventory → `audit.recorded` → reporting; `/nhat-ky` shows row |

## 3. Authenticated Admin browser

| Check | Evidence level |
| ----- | -------------- |
| Admin login | PASS_BROWSER |
| Manager / SuperAdmin / Staff login | PASS_BROWSER (Playwright rbac-roles) |
| HCM-NGUYEN-HUE visible | PASS_BROWSER |
| Create store HN-ACCEPT-01 | PASS_BROWSER + API |
| Disable / re-enable | PASS_BROWSER (INACTIVE badge) + Admin API |
| Persistence after refresh/restart | PASS_RUNTIME (inventory stop/start) |
| Staff mutation 403 | PASS_API_ONLY (POST stores **403**) |
| Audit in Admin UI | PASS_BROWSER (`inventory.store.updated`) |

## 4. Authenticated Customer browser

| Check | Evidence level |
| ----- | -------------- |
| Login customer1 | PASS_BROWSER |
| Add to cart | PASS_BROWSER |
| Pickup store cards / no raw storeId | PASS_BROWSER |
| Select HCM-NGUYEN-HUE + COD order | PASS_BROWSER (Playwright; order `NT-20260803-TCXQ8H`) |
| Exactly one new order per run | PASS_BROWSER |
| Cart clears | PASS_BROWSER |
| Detail shows store name/address/phone | PASS_BROWSER |
| No shipment error for pickup | PASS_BROWSER |
| customer2 isolation | PASS_BROWSER |

## 5. media:audit

| Before | After |
| ------ | ----- |
| Reported 8/10 (script only sampled `slice(0,8)`) | Sample all page items; require full coverage → **10/10 PASS** |

## 6. Full gates (all exit 0)

format · lint · test · e2e (24) · `NODE_ENV=production` build · address-data:validate · media:audit · openapi generate/combine/validate (391) · security:validate · security:test:secure · security:smoke

## 7. Constraints honored

No `git reset --hard`, no volume wipe, no DB drop/truncate, no commit/push, intentional vulns remain always-on.
