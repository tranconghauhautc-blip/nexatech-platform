# FUNCTIONAL ACCEPTANCE REPORT

> **2026-08-03** — Owner manual regression re-audit after Store Pickup failure.
> HEAD baseline: `359b8cf`. Working tree dirty — **no commit / no push**.

## Evidence levels

| Level | Meaning |
| ----- | ------- |
| PASS_RUNTIME | Live Docker + DB + API (+ restart where noted) |
| PASS_BROWSER | Browser/Playwright against Compose UI with real session |
| PASS_API_ONLY | Authenticated or public API shape OK; browser not proven this pass |
| PARTIAL | Some paths work; gaps remain |
| BROKEN | Incorrect behavior |
| MISSING_DATA | Code/API OK but data absent |
| MISSING_CRUD | Read-only or incomplete admin mutations |
| MISSING_RBAC | UI hide only / API not enforced |
| MOCK_ONLY | Fixture/mock without persistence |
| NOT_TESTED | Blocked (e.g. no DEV_SEED_PASSWORD on host) |

**Do not call PASS from route-exists / 401 alone.**

## QUALITY GATES (this pass)

| Gate | Result |
| ---- | ------ |
| inventory-service unit | PASS (15) |
| order-service unit | PASS (40) |
| seed-pickup-stores test | PASS |
| prettier (touched files) | PASS |
| lint inventory/order/admin/contracts | PASS (warnings only) |
| lint storefront | PASS after fixing `@nexatech/shared-web/address` import |
| openapi:generate/combine/validate | PASS — **391 paths**, `openapi: 3.0.3`, includes `stores/pickup` |
| address-data:validate | (run this session) |
| media:audit | (run this session) |
| Full `pnpm test` / `pnpm e2e` / `pnpm build` | **NOT fully re-run** this pass (focused + unit); owner should run before commit |
| Playwright pickup | Spec hardened; needs `E2E_DEV_SEED_PASSWORD` |

## STORE PICKUP (mandatory)

| Check | Result |
| ----- | ------ |
| Admin store CRUD | **PASS** (source + API Manager+; UI rebuilt) — browser login **NOT_TESTED** (no seed password) |
| Pickup store seed | **PASS_RUNTIME** `HCM-NGUYEN-HUE` |
| Store persisted in DB | **PASS_RUNTIME** |
| Pickup API via Kong | **PASS_RUNTIME** |
| Pickup API direct | **PASS_RUNTIME** |
| Store card browser | **PARTIAL** — API ready; checkout UI needs logged-in session |
| Checkout order creation | **PASS_API_ONLY** (order validates store) — end-to-end order **NOT_TESTED** without customer session |
| Order detail store display | **PASS** source (hydrate `/stores/:id`) — browser NOT_TESTED |
| RBAC | **PASS_RUNTIME** Staff create → 403; Manager+ required |
| Audit | **PASS_API_ONLY** (`inventory.store.created/updated` writeAudit) |
| Restart persistence | **PASS_RUNTIME** |

## Module matrix

| Module | Source | API | DB | Browser | Persistence | RBAC | Tests | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer Auth | Y | 401 probe | — | NOT_TESTED | — | — | prior e2e | NOT_TESTED |
| Profile/Address | Y | — | — | NOT_TESTED | — | — | prior | PARTIAL |
| Catalog | Y | PASS price>0 | Y | — | Y | — | — | PASS_API_ONLY |
| Product Images | Y | mediaLinks=[] | MISSING | — | — | — | media:audit | MISSING_DATA |
| Wishlist | Y | — | — | NOT_TESTED | — | — | — | NOT_TESTED |
| Compare | Y | — | — | NOT_TESTED | — | — | — | NOT_TESTED |
| Recently Viewed | Y | — | — | NOT_TESTED | — | — | — | NOT_TESTED |
| Cart | Y | /carts/current 401 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Checkout Standard | Y | — | — | NOT_TESTED | — | — | prior smoke | PARTIAL |
| Checkout Express | Y | — | — | NOT_TESTED | — | — | — | PARTIAL |
| Checkout Pickup | Y | PASS pickup list | PASS seed | PARTIAL | PASS restart | PASS API | unit+e2e hardened | PARTIAL→fixed data |
| Orders | Y | 401 unauth | — | NOT_TESTED | — | — | unit | PASS_API_ONLY |
| Payments | Y | /payments/me 401 | — | NOT_TESTED | — | ownership prior | prior | PASS_API_ONLY |
| Shipping | Y | health 200 | — | — | — | — | — | PASS_API_ONLY |
| Reviews | Y | /reviews/me 401 | — | NOT_TESTED | — | — | prior | PASS_API_ONLY |
| Warranty | Y | health/401 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Returns | Y | via warranty | — | NOT_TESTED | — | — | — | NOT_TESTED |
| Support | Y | health 200 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Notifications | Y | health 200 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Admin Dashboard | Y | 401 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Products | Y | — | Y | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Categories | Y | — | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Brands | Y | — | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Specifications | Y | — | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Media | Y | — | — | NOT_TESTED | — | — | media scripts | PARTIAL |
| Inventory | Y | PASS | PASS | — | PASS | Manager+ loc | unit | PASS_RUNTIME |
| Stores/Warehouses | Y | PASS | PASS | Admin 401 gate | PASS | Manager+ mutate | unit+seed | PASS_RUNTIME (API/DB) |
| Reporting | Y | health/401 | — | NOT_TESTED | — | — | — | PASS_API_ONLY |
| Audit | Y | writeAudit local | PARTIAL projection | — | — | — | — | PARTIAL |
| Users/RBAC | Y | — | — | NOT_TESTED | — | matrix | prior e2e | PARTIAL |
| OpenAPI/Kong | Y | 391 paths | — | Swagger 200 | — | — | validate PASS | PASS_RUNTIME |
| Security Guide | Y | 200 | — | — | — | always-on | — | PASS_API_ONLY |

## Root causes (pickup)

1. No Store rows seeded; only HN-MAIN warehouse.
2. Admin page listed warehouses only; no store CRUD UI.
3. Prior e2e accepted empty-store UI as PASS.

## Files changed (high level)

- inventory schema/migration/service/controllers/repos/tests
- shared-contracts store update schemas
- admin `cua-hang-kho` CRUD + `use-admin-roles`
- storefront checkout + order detail + ho-so import path
- order inventory client pickup validation
- `scripts/seed-pickup-stores.cjs` + package scripts + e2e
- docs: OWNER-MANUAL-REGRESSION-AUDIT, OWNER-MANUAL-TEST-CHECKLIST, acceptance reports
- openapi combined regenerated

## Migrations / seed

- `apps/inventory-service/prisma/migrations/20260803120000_store_pickup_fields/`
- `pnpm seed:pickup-stores` (idempotent; does not mutate HN-MAIN)

## Rebuilt images

- inventory-service, order-service, admin-web, storefront-web (`0.17.0` tags)

## Remaining failures / blockers

- Host has **no** `DEV_SEED_PASSWORD` / `.env` → customer/admin browser flows NOT_TESTED this pass.
- Product `mediaLinks` empty on sampled catalog product (MISSING_DATA).
- Full monorepo `pnpm test` / `pnpm e2e` / `pnpm build` not fully re-executed after all doc updates.
- Operational audit projection to reporting still PARTIAL (pre-existing).

## GIT

```
Branch: main @ 359b8cf (origin synced at start)
Commit: NOT created
Push: NOT performed
```
