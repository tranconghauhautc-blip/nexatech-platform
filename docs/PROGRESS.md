# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Full project re-baseline (OpenAPI 3.0.3, Security Guide auth, functional audit)
- **Milestone đã hoàn thành gần nhất:** M21 (security lab / OWASP) + post-hardening
- **Cập nhật lần cuối:** 2026-08-01
- **Branch:** `main`
- **Baseline docs:** `docs/CURRENT-PROJECT-BASELINE.md`, `CUSTOM-CHANGES-INVENTORY.md`, `FULL-SYSTEM-AUDIT.md`
- **Latest commit note:** Security Guide auth + OpenAPI 3.0.3 re-baseline pushed (`16355e8`+)

## Re-baseline in progress

- [x] Git inventory + baseline docs
- [x] Admin wrong-password visible error + cart login redirect + cart cookie Lax
- [x] `AppErrorFilter` on all 14 Nest services
- [x] Force OpenAPI **3.0.3** (generate/validate/diff/check) + ADR
- [x] Security Guide portal scaffold (`:3200`) + `pnpm security-guide:setup`
- [x] Scenario SSoT seed (`security-scenarios/`)
- [x] Expand security-scenarios SSoT (24 scenarios; API1–10 covered)
- [x] Authenticated Security Guide tests (`pnpm security-guide:test`)
- [x] Product image import script (`scripts/import-product-images.cjs`)
- [x] Authenticated guide serves HTML OWASP guides (storefront `/lab` = redirect stub)
- [x] Full storefront/admin HTTP smoke (`pnpm lab:smoke` PASSED after storefront rebuild)
- [ ] Owner-supplied product images import
- [ ] Full browser E2E checkout (needs seed password)

## Roadmap milestone

| ID     | Milestone                                        | Trạng thái | Ghi chú   |
| ------ | ------------------------------------------------ | ---------- | --------- |
| M0–M18 | …                                                | ✅ Done    |           |
| M19    | Deployment preflight / release readiness         | ✅ Done    | `2fad006` |
| M20    | Performance / reliability / DR                   | ✅ Done    | `53247e4` |
| M21    | Security lab / OWASP intentional vulnerabilities | ✅ Done    | ADR-040   |
| RB     | Full re-baseline / OpenAPI 3.0.3 / Guide auth    | 🔄 Active | `0f6f88b`+ |

## Commits

| Commit    | Nội dung                       |
| --------- | ------------------------------ |
| `2fad006` | M19 preflight/release          |
| `f202367` | M19 docs hash                  |
| `53247e4` | M20 performance/reliability/DR |
| `20e98bb` | M21 security lab / OWASP       |
| `d859687` | Fix Nest Docker runtime deps   |

## M21 checklist (Done)

- [x] Production vs security-lab Helm profiles
- [x] Lab image tags / build args (identity + build script)
- [x] 30 intentional vulnerabilities (lab-only gate) covering API1–API10 and A01–A10
- [x] PoC + secure regression tests
- [x] Lab isolation docs + NetworkPolicy path
- [x] OWASP-SCENARIOS dual matrices (API 2023 + Web 2025) + FINAL-HANDOFF + checklists
- [x] Feature commit `20e98bb`
- [x] Post-M21: `pnpm seed:accounts` (no hard-coded passwords)

## Local security training lab checklist (ADR-043)

- [x] `docs/LOCAL-LAB-LINKS.md` — browser entry points từ Compose ports
- [x] `docs/SWAGGER-LINKS.md` — 14 Swagger + OpenAPI JSON + Kong
- [x] `docs/LOCAL-SECURITY-LAB-GUIDE.md` — 19 bước learner guide
- [x] `docs/OPENAPI-GUIDE.md` + `pnpm openapi:generate|combine|validate`
- [x] Shared `setupNexaTechSwagger` trên 14 Nest services
- [x] Identity Swagger auth DTOs + `GET /auth/me`
- [x] Admin `/unauthorized`, `/forbidden`, RBAC route guard, `/security-lab` (lab-only)
- [x] Playwright `e2e/admin/rbac-roles.spec.ts` (4 roles)
- [x] `pnpm lab:smoke` HTTP validation
- [x] Format / lint / test / build / e2e / lab smoke / OpenAPI validate
- [x] Local commit (no push)

## BLOCKED_EXTERNAL

- Citrix ADC whitelist / Imperva lab policy
- Live K8s/Kong deploy
- Docker Hub push
- Production credentials / restore drills

## Nhật ký

### 2026-08-01 — Audit gap-close (sort, admin users CRUD, SC-76…95, ADR-044 docs)

- Admin `danh-muc` / `thuong-hieu` (+ kho, cửa hàng, media, thông báo, nhật ký, báo cáo) ListToolbar `sortOptions`.
- Identity `POST /admin/users`, `POST|DELETE …/disable`, `GET …/export`; Super Admin UI create + soft-disable.
- OWASP density: SC-76…SC-95 HTTP-executable always-on; matrices ~30+ API / ~30+ Web; public HTML guides updated.
- Docs: SECURITY-BASELINE / FINAL-HANDOFF / DECISIONS ADR-040 aligned with ADR-044 (vulns always on).
- Focused tests: `shared-security-lab` (+ identity auth where needed).

### 2026-08-01 — Storefront filters: brand/category selects + guest tracking

- ProductFilters: brand `<select>` từ `GET /brands`; search page thêm category select từ cây danh mục.
- Category PLP: min/max price wired; breadcrumb không còn trùng “Trang chủ”.
- Guest `/tra-cuu-don-hang` (public shipping tracking); hồ sơ địa chỉ có form thêm; admin danh-mục/thương-hiệu search+filter.
- Footer “Tra cứu đơn hàng” → public page.

### 2026-08-01 — Production UX + always-on OWASP for WAF PoC

- Show/hide password (admin + storefront auth).
- Admin ListToolbar search/filter/sort trên hầu hết list pages; media theo entity ID; `/nguoi-dung` thật.
- Identity `GET/PATCH /api/v1/admin/users` + Kong route; BFLA/mass-assignment/DTO leak always-on.
- Storefront: PLP price/brand filters, XSS reflect search, wishlist/compare/orders polish; public HTML guides `/lab/owasp-*.html`.
- **ADR-044:** intentional vulns ALWAYS ON — no `FORCE_SECURE`, no security-lab dual gate; policies hardcode vulnerable path; SSRF probe fetches.
- **Gap-close:** SC-70 `alg=none` accepted on `/auth/me`; SC-75 login `details` PII; SC-28 cookies; SC-30 CORS reflect; SC-71…74 wired on storefront; lab routes excluded from Nest `api` prefix; ADR-045 for Swagger portal; docs dual-gate residue cleaned.
- Docs: API-CONTRACTS admin users, DECISIONS ADR-044/045, OWASP guides links.

### 2026-08-01 — Combined Swagger portal + admin list path fixes

- Admin: `van-chuyen` → `admin/shipments` (fix 404); `kho-hang` → `useArrayQuery` for array-shaped `/stock`.
- New `apps/swagger-portal` on `:8090`, Kong local routes `/docs` + `/openapi` → combined OpenAPI UI; gated for lab/dev only (absent from production Kong).
- Combined tags: Identity…Reporting; `pnpm lab:smoke` checks portal + Kong `/docs`.
- Docs: LOCAL-LAB-LINKS, SWAGGER-LINKS, LOCAL-SECURITY-LAB-GUIDE, API-CONTRACTS.

### 2026-08-01 — Swagger Try-it-out Failed to fetch (ADR-043)

- **Root cause:** Live Swagger included `https://api.example.invalid`; UI selected it → browser `Failed to fetch`.
- **Fix:** Live servers = same-origin `/` + localhost + Kong; drop production placeholder from UI; strip browser-forbidden headers (`user-agent`); login đọc UA từ request thật.
- Identity image rebuild `nexatech/identity-service:0.17.0`; OpenAPI export normalize + validate OK.

### 2026-08-01 — Local security training lab (ADR-043)

- OpenAPI 3 export/combine/validate; combined spec for Burp/ZAP/Postman.
- Browser lab docs + Swagger links; admin forbidden/unauthorized + lab dashboard gate.
- Identity Authorize flow (`/auth/me`); HTTP `lab:smoke`; 4-role Playwright smoke.

### 2026-08-01 — Dev account seed rewrite + OWASP API/Web coverage expand

- Removed rejected `seed:identity` / `Secret123` hard-coded seed.
- Added `pnpm seed:accounts` with dual guards (`NEXATECH_ALLOW_DEV_SEED`, `DEV_SEED_PASSWORD`), password policy, bcrypt cost 10, idempotency, optional `DEV_SEED_RESET_PASSWORD`, `User.isDevSeed` migration.
- Expanded security lab to **30** intentional scenarios covering OWASP API Top 10:2023 (API1–API10) and OWASP Web Top 10:2025 (A01–A10) with dual coverage matrices in `docs/OWASP-SCENARIOS.md`.

### 2026-07-31 — Local Docker Compose runtime packaging fix (ADR-041)

- **Root cause:** Nest webpack `generatePackageJson` externalize deps nhưng runtime image không `pnpm install --prod`; `tslib` ở `devDependencies` bị omit khỏi dist package.json dù `importHelpers` emit `require('tslib')`.
- **Fix:** `tslib` → `dependencies`; regenerate 14 Dockerfiles via `scripts/m16-gen-dockerfiles.mjs` (install prod deps từ Nx pruned lockfile); health `VERSION_NEUTRAL`; frontend `HOSTNAME=0.0.0.0`.
- **Validation:** `docker compose` apps stack — 14/14 Nest healthy, storefront/admin healthy, Kong healthy; smoke `/health/live` OK; no `MODULE_NOT_FOUND`.
- **Commit:** `d859687`

### 2026-07-30 — M21 done

- shared-security-lab policies; wired into order/payment/review/shipping/warranty/support/media/identity/BFF
- values-security-lab.yaml; lab marker `/health/lab`; security test runners
- Docs: OWASP-SCENARIOS, SECURITY-LAB-\*, FINAL-HANDOFF, DEPLOYMENT-CHECKLIST, KNOWN-LIMITATIONS
- **Roadmap M0–M21 complete. Do not start a new milestone.**

### 2026-07-30 — M20 done

- Feat `53247e4`
