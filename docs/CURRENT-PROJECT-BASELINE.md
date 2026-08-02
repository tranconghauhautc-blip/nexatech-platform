# CURRENT PROJECT BASELINE

> Re-baselined **2026-08-02** from Git + source + Docker runtime. Prefer this over older snapshots.
> **No commit in this phase** (owner review gate).

## 1. HEAD / branch / working tree (at session start)

| Item                 | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Branch               | `main`                                                                           |
| HEAD                 | `eab86ca` — `feat: add pnpm seed:customers for Storefront Customer lab accounts` |
| Working tree (start) | **Clean** (up to date with `origin/main`)                                        |
| Remote               | `origin/main` tracked                                                            |

### Recent commits (relevant)

| Commit    | Summary                                             |
| --------- | --------------------------------------------------- |
| `eab86ca` | `seed:customers` Storefront lab accounts            |
| `0a77d03` | Re-baseline checkout smoke, images, session cookie  |
| `d5d8af4` | OWASP HTML guides behind Security Guide auth        |
| `16355e8` | Security scenarios expand + image import tooling    |
| `0f6f88b` | OpenAPI 3.0.3, security guide portal, login/cart UX |
| `6f261cc` | Guest cart token + buy-now flow                     |
| `20e98bb` | M21 security-lab / OWASP                            |
| `d859687` | Nest Docker runtime deps fix                        |

## 2. Frontend apps

| App                   | Port | Notes                                    |
| --------------------- | ---- | ---------------------------------------- |
| storefront-web        | 3000 | Next.js; BFF `/api/bff/*`, `/api/auth/*` |
| admin-web             | 3100 | Next.js Admin Portal                     |
| swagger-portal        | 8090 | Combined OpenAPI UI                      |
| security-guide-portal | 3200 | Authenticated OWASP guides               |

## 3. Backend microservices (Compose host ports)

| Service      | Port |
| ------------ | ---- |
| identity     | 3001 |
| customer     | 3002 |
| catalog      | 3003 |
| media        | 3004 |
| inventory    | 3005 |
| cart         | 3006 |
| order        | 3007 |
| payment      | 3008 |
| shipping     | 3009 |
| review       | 3010 |
| warranty     | 3011 |
| support      | 3012 |
| notification | 3013 |
| reporting    | 3014 |

Health: `GET /health`, `/health/live`, `/health/ready` (unversioned). API prefix: `/api/v1` (+ `/api/v2`).

## 4. Infrastructure (Docker healthy at audit)

| Component     | Port(s)     | Compose                                |
| ------------- | ----------- | -------------------------------------- |
| PostgreSQL 16 | 5432        | `infra/docker/docker-compose.dev.yml`  |
| Redis         | 6379        | same                                   |
| RabbitMQ      | 5672, 15672 | same                                   |
| MinIO         | 9000, 9001  | same                                   |
| Kong          | 8000, 8001  | `infra/docker/docker-compose.apps.yml` |

**Runtime probe 2026-08-02:** all 14 Nest + storefront + admin + swagger + security-guide + postgres + redis + rabbitmq + minio + kong = **healthy**.

## 5. Kong

- Flat routes `/api/v1|v2/...` (no service name prefix).
- Payments, media, admin users, carts, orders routed.
- Combined docs via portal + Kong `/docs` (lab).

## 6. OpenAPI

| Item             | State                                                      |
| ---------------- | ---------------------------------------------------------- |
| Required version | **3.0.3 only**                                             |
| Combined         | `openapi/nexatech-combined.openapi.{json,yaml}` → 3.0.3    |
| Scripts          | `openapi:generate`, `combine`, `validate`, `diff`, `check` |
| Approx paths     | **383 paths / 429 operations** (2026-08-02 acceptance)     |

## Final acceptance (2026-08-02)

Local Compose acceptance completed in working tree (no commit): authenticated payments/reviews PASS; Playwright 23/23; media-e2e PASS; security always-on EXPLOITABLE; format/lint/test/build PASS. See `docs/FUNCTIONAL-ACCEPTANCE-REPORT.md`.

## 7. Security / OWASP

| Item                        | State                                                      |
| --------------------------- | ---------------------------------------------------------- |
| Intentional vulns           | **ALWAYS ON** (ADR-044); `isSecurityLabEnabled()` → `true` |
| Dual secure/vulnerable mode | **Forbidden** — do not restore                             |
| SSoT                        | `security-scenarios/` (~36 scenarios)                      |
| Guides                      | Authenticated portal `:3200`                               |

## 8. Seed commands

| Command                      | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `pnpm seed:accounts`         | Staff/Manager/Admin/SuperAdmin         |
| `pnpm seed:customers`        | `customer1@` / `customer2@` Storefront |
| `pnpm seed:catalog`          | ~100 products                          |
| `pnpm seed:inventory`        | Stock all SKUs                         |
| `pnpm import:product-images` | Bulk image import                      |
| `pnpm checkout:smoke`        | Register→cart→order→COD                |
| `pnpm lab:smoke`             | HTTP lab smoke                         |

## 9. Verified root causes (unintentional bugs)

| Symptom                       | Root cause                                                                    | Fix status                                       |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `Cannot GET /api/v1/payments` | No customer list handler; storefront called `GET /payments`                   | **Fixed** — `GET /payments/me` + frontend        |
| Admin product price `0 ₫`     | `Math.min(..., 0)` always ≤0 in `prisma-catalog.repository.ts`                | **Fixed in source** (image rebuild)              |
| Admin order `—`               | UI reads `code`; API `orderCode`                                              | **Fixed in source**                              |
| Reviews empty → error         | `GET /reviews/me` missing on review-service                                   | **Fixed**                                        |
| Wishlist UUID only            | Wishlist stores `productId` only; no catalog hydrate                          | **Fixed** via `/products/summaries`              |
| Pickup raw `storeId`          | Checkout free-text input                                                      | **Fixed** — store selector + `pickupStoreId`     |
| Cart badge after checkout     | Result page may not refresh cart                                              | **Fixed** — `refresh()` on result page           |
| Shipment after CONFIRMED      | Confirm publishes event only; no auto-create consumer                         | Pending (explicit create)                        |
| Audit empty                   | Most services local `writeAudit`; few `AUDIT_RECORDED` → reporting projection | Pending                                          |
| Address free-text             | No VN province/ward dataset                                                   | **Fixed** — dataset + selector + codes migration |
| Media Entity ID               | Admin media lookup by raw UUID; limited upload UI                             | **Fixed (UI)** — product selector + upload       |

## 10. Assumptions discarded

- Docs claiming OpenAPI still mix 3.0.0 / missing `openapi:diff` — **stale** (scripts exist; combined is 3.0.3).
- Docs claiming Security Guide scripts missing — **stale**.
- Docs claiming public storefront OWASP HTML as primary — **stale** (behind Guide auth).
- Dual security-lab ON/OFF for vulns — **rejected by ADR-044**.

## 11. Related docs

- `docs/CUSTOM-CHANGES-INVENTORY.md`
- `docs/CUSTOMER-ADMIN-CURRENT-BASELINE.md`
- `docs/CUSTOMER-ADMIN-FULL-AUDIT.md`
- `docs/ADMIN-PORTAL-AUDIT.md`
- `docs/PROGRESS.md`
