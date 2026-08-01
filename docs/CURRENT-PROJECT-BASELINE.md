# CURRENT PROJECT BASELINE

> Snapshot at start of full re-baseline. **Do not treat as complete audit** — living doc until acceptance finishes.
> Generated from repository + Git + Compose + runtime probes. **No commit in this phase.**

## 1. HEAD / branch / working tree

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `6f261ccd2af4bfc19b59f4d577f5764d1db24d3c` — `fix(cart): persist guest cart token and restore buy-now flow` |
| Working tree (at doc write) | Dirty — admin login UX, storefront buy-now require-login, cart cookie SameSite=Lax (uncommitted) |
| Remote | `origin/main` (last push included `6f261cc`; subsequent fixes **not** committed per owner request) |

## 2. Frontend apps

| App | Port | Image tag (compose) | Notes |
| --- | --- | --- | --- |
| storefront-web | 3000 | `nexatech/storefront-web:0.17.0` | Next.js; BFF `/api/bff/*`, `/api/auth/*` |
| admin-web | 3100 | `nexatech/admin-web:0.17.0` | Next.js Admin Portal |
| swagger-portal | 8090 | compose service | Combined OpenAPI UI |

## 3. Backend microservices (Compose host ports)

| Service | Port |
| --- | --- |
| identity-service | 3001 |
| customer-service | 3002 |
| catalog-service | 3003 |
| media-service | 3004 |
| inventory-service | 3005 |
| cart-service | 3006 |
| order-service | 3007 |
| payment-service | 3008 |
| shipping-service | 3009 |
| review-service | 3010 |
| warranty-service | 3011 |
| support-service | 3012 |
| notification-service | 3013 |
| reporting-service | 3014 |

## 4. Infrastructure

| Component | Port(s) | Compose file |
| --- | --- | --- |
| PostgreSQL 16 | 5432 | `docker-compose.dev.yml` |
| Redis | 6379 | same |
| RabbitMQ | 5672, 15672 | same |
| MinIO | 9000, 9001 | same |
| Kong | 8000, 8001 | `docker-compose.apps.yml` |

## 5. Kong

- Routes under `/api/v1/...` and `/api/v2/...` per service (flat paths, **no** `/{service}` prefix).
- Recent fix: duplicate `identity-admin-users` route removed; cart paths include `/api/v1/carts`.
- Known risk: restart fails if declarative config has duplicate route names.

## 6. Seed commands

| Command | Purpose |
| --- | --- |
| `pnpm seed:accounts` | Staff/Manager/Admin/SuperAdmin (`DEV_SEED_PASSWORD`, `NEXATECH_ALLOW_DEV_SEED=YES`) |
| `pnpm seed:catalog` / `node scripts/seed-catalog.cjs` | ~100 catalog products |
| `node scripts/seed-inventory.cjs` | Demo warehouse stock for all SKUs (`NEXATECH_ALLOW_DEV_SEED=YES`) |

## 7. Swagger / OpenAPI (current)

| Item | Current state |
| --- | --- |
| Per-service `/docs` | Expected on each backend port |
| Combined portal | `http://localhost:8090` (+ Kong `http://localhost:8000/docs` if routed) |
| Combined specs | `openapi/nexatech-combined.openapi.yaml` + `.json` → **`openapi: 3.0.3`** |
| Per-service YAML/JSON | Mostly **`openapi: 3.0.0`** (Nest default) — **must standardize to 3.0.3** |
| `api.example.invalid` | Still present as a server entry in generated specs / combined (must not be default Try-it-out) |
| Scripts | `openapi:generate`, `openapi:combine`, `openapi:validate` — **missing** `openapi:diff`, `openapi:check` |

## 8. Security / OWASP status

| Item | State |
| --- | --- |
| Intentional vulns | **ALWAYS ON** (`isSecurityLabEnabled()` → `true`; ADR-044) |
| Toggle / dual mode | Removed from runtime policy; docs still mention Helm `NEXATECH_SECURITY_LAB` as **isolation marker only** |
| Scenario catalog | `docs/OWASP-SCENARIOS.md` — ~SC-01…67 + SC-70…95; API Top 10:2023 and Web Top 10:2025 **separate matrices in one file** |
| Public HTML guides | `/lab/owasp-api-top10.html`, `/lab/owasp-web-top10.html` on storefront (no Security Guide auth yet) |
| `security-guide:*` scripts | **None** yet |

## 9. Custom changes (recent HEAD history)

See `docs/CUSTOM-CHANGES-INVENTORY.md`. Highlights: always-on OWASP, admin users CRUD, TGDD-style filters, facets API, AppErrorFilter (identity/cart), Kong URL fix, guest cart cookie, inventory seed.

## 10. Known bugs (active)

| Bug | Status |
| --- | --- |
| Admin wrong-password no visible feedback | **Fixing** — stronger alert UI + rebuild admin image |
| Guest cart “Thiếu cart token” | Root cause: SC-28 `SameSite=None; Secure=false` cookie **rejected by browser**; cookie now `SameSite=Lax`. Owner also requires **login redirect** for add/buy when anonymous |
| OpenAPI 3.0.0 vs required 3.0.3 | Open gap |
| Product images missing (placeholder) | Open gap |
| Full functional E2E not re-verified in this snapshot | Pending audit |

## 11. Dependency-ordered plan (re-baseline)

1. Stabilize login + cart UX (in progress, no commit).
2. Finish repository inventory docs (this + CUSTOM + FULL-SYSTEM-AUDIT stubs).
3. OpenAPI 3.0.3 shared swagger setup + regenerate all specs.
4. Combined portal + Security Guide (authenticated) + scenario SSoT.
5. OWASP API vs Web independent audit (no false merge).
6. Functional storefront/admin/ecom E2E + image import guide.
7. Docker smoke, tests, secret scan.
8. **Stop for owner review — no commit/push until approved.**

## 12. Assumption purge

Do **not** rely on: old milestone handoffs as truth, security-lab ON/OFF, secure/vulnerable dual branches, “production-safe” meaning vulns off. Prefer runtime + current source.
