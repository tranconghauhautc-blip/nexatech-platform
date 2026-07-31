# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(roadmap M0–M21 hoàn tất — không bắt đầu milestone mới)_
- **Milestone đã hoàn thành gần nhất:** M21 (security lab / OWASP)
- **Cập nhật lần cuối:** 2026-08-01
- **Branch:** `main`
- **Local Compose:** 14 Nest backends + storefront + admin + Kong **healthy** (ADR-041 runtime packaging fix)
- **Post-M21 hardening:** DEV `seed:accounts` + OWASP API 2023 / Web 2025 coverage matrices (30 scenarios)

## Roadmap milestone

| ID     | Milestone                                        | Trạng thái | Ghi chú   |
| ------ | ------------------------------------------------ | ---------- | --------- |
| M0–M18 | …                                                | ✅ Done    |           |
| M19    | Deployment preflight / release readiness         | ✅ Done    | `2fad006` |
| M20    | Performance / reliability / DR                   | ✅ Done    | `53247e4` |
| M21    | Security lab / OWASP intentional vulnerabilities | ✅ Done    | ADR-040   |

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

## BLOCKED_EXTERNAL

- Citrix ADC whitelist / Imperva lab policy
- Live K8s/Kong deploy
- Docker Hub push
- Production credentials / restore drills

## Nhật ký

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
