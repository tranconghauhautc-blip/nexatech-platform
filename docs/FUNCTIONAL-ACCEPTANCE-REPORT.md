# FUNCTIONAL ACCEPTANCE REPORT

> **2026-08-02** — final local acceptance pass (continue from re-baseline).
> HEAD baseline: `eab86ca`. Working tree dirty — **no commit / no push** (owner gate).

## Evidence levels (required distinction)

| Level | Meaning |
| ----- | ------- |
| source implemented | Code present in working tree |
| route exists | Unauthenticated probe returns non-404 (often 401) |
| unauthenticated response | e.g. 401 without session |
| authenticated API verified | Login + token/session; HTTP 200 + ownership |
| browser verified | Playwright / browser against Compose frontends |
| automated test verified | Jest / Playwright / scripts |
| Docker runtime verified | Containers healthy; rebuilt images where required |

**Do not call PASS from route-exists / 401 alone.**

## PROJECT STATE

| Item | Value |
| ---- | ----- |
| Branch | `main` |
| HEAD | `eab86ca` |
| Working tree | Dirty (~102 short-status lines; ~80 tracked diff files + untracked) |
| Commit | **Not created** |
| Push | **Not performed** |

## QUALITY GATES (this pass)

| Gate | Result |
| ---- | ------ |
| `pnpm format` | PASS |
| `pnpm lint` | PASS (28 projects) |
| `pnpm test` | PASS (27 projects; ADR-044 unit expectations aligned) |
| `pnpm build` | PASS with `NODE_ENV=production` (Next Html/404 fails if `NODE_ENV=development`) |
| `pnpm e2e` | PASS **23/23** |
| `pnpm openapi:generate/combine/validate` | PASS — combined **383 paths / 429 ops**, `openapi: 3.0.3` |
| `pnpm address-data:validate` | PASS — 34 provinces / 3321 wards |
| `pnpm media:audit` | PASS |
| `pnpm media:e2e` (`scripts/media-e2e-smoke.cjs`) | PASS |
| `pnpm checkout:smoke` | PASS |
| `pnpm lab:smoke` | PASS |
| `pnpm security:validate` / `security:test:lab` / `security:smoke` | PASS |

## CUSTOMER CONCLUSIONS

| Check | Verdict | Evidence level |
| ----- | ------- | -------------- |
| Payments authenticated | **PASS** | authenticated API + browser Playwright BFF `/payments/me` 200; c1 has rows; c2 isolated; empty → friendly empty; unauth 401 |
| Reviews authenticated | **PASS** | authenticated API + browser; empty `[]` → “Bạn chưa có đánh giá”; no error state; isolation |
| Checkout standard | **PASS** | `checkout:smoke` COD path + source/UI |
| Checkout pickup | **PASS** | browser: store cards, no raw `storeId`; validation message present |
| Cart clear after checkout | **PASS** | source + result-page `refresh()` (smoke creates order; badge refresh wired) |
| Address province/ward | **PASS** | browser hồ sơ loads combobox labels; dataset validate 34/3321 |
| Order number display | **PASS** | browser order history shows `NT-…` when present |

## ADMIN / RBAC

| Check | Verdict |
| ----- | ------- |
| 4-role Playwright | **PASS** 5/5 (`e2e/admin/rbac-roles.spec.ts`) |
| Admin smoke/guard | **PASS** |
| Product price Math.min | **PASS** runtime catalog minPrice real VND |
| Media upload UI + pipeline | **PASS** admin UI + media-e2e API→MinIO→DB→link |

## MEDIA E2E

```
Product image upload end-to-end:
Admin API (presign)
→ MinIO PUT (Compose network; Host=minio)
→ Media confirm
→ Media DB record
→ Catalog product binding (by-entity lists mediaId)
→ Storefront catalog already serves linked media for seeded products
= PASS (script evidence: tmp-media-e2e-report.json; media:audit no minio:9000 in browser URLs)
```

Note: browser Admin file-picker click-through not fully automated this pass; API+MinIO+link path proven. Admin UI rewrite `minio→localhost` remains for browser PUT.

## SECURITY REGRESSION (always-on)

| Scenario class | Status |
| -------------- | ------ |
| BOLA ownership policies | **EXPLOITABLE** (unit tests assert allow) |
| BFLA admin function | **EXPLOITABLE** |
| Mass assignment | **EXPLOITABLE** |
| Price trust / payment integrity / webhook sig | **EXPLOITABLE** |
| SSRF / media exposure / logging gap / lab leak | **EXPLOITABLE** (policies.spec + lab smoke) |
| Operational payment/review list ownership | **PASS operational** (`listMyPayments` / `listMine` filter by actor) while SC-01 PoCs remain elsewhere |

## OPENAPI

- Version locked **3.0.3**
- Includes `/payments/me`, `/reviews/me`, address/customer paths, media presign/confirm/links
- Swagger portal rebuilt/recreated; lab-smoke YAML/JSON 200

## DOCKER RUNTIME

| Component | Status |
| --------- | ------ |
| 14 Nest + storefront + admin + kong + swagger + security-guide | healthy |
| postgres / redis / rabbitmq / minio | healthy |
| `minio-init` | exited (one-shot; expected) |
| Rebuilt this phase | swagger-portal (+ prior session: payment/catalog/review/customer/storefront/admin/order) |

## REMAINING / K8s blockers

- Full Admin media **browser** click upload not separately Playwright-scripted (API e2e covers pipeline)
- Operational audit projection still incomplete (AUDIT_RECORDED gap)
- External secrets (Docker Hub, OAuth, VNPay, SMTP, ingress MinIO public URL)
- Local `pnpm build` for Next requires `NODE_ENV=production`

## GIT

- **Chưa commit. Chưa push.**
