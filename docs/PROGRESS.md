# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Full project re-baseline — **final local acceptance complete for owner review**
- **Cập nhật lần cuối:** 2026-08-02
- **Branch:** `main` @ `eab86ca` (+ uncommitted working tree — **chưa commit**)
- **Owner gate:** Dừng trước commit / không push

## Re-baseline 2026-08-02 — FINAL ACCEPTANCE

### Done

- [x] OpenAPI generate/combine/validate — **383 paths / 429 ops**, `openapi: 3.0.3`
- [x] Authenticated payments/reviews (API + Playwright BFF) — **PASS** (not 401-only)
- [x] Address browser hồ sơ + pickup checkout UI Playwright
- [x] `pnpm media:audit` + `pnpm media:e2e` (presign→MinIO→confirm→link)
- [x] Security regression (`security:validate` / `test:lab` / `smoke`) — always-on **EXPLOITABLE**
- [x] Unit tests aligned to ADR-044 (BOLA/webhook PoCs assert allow)
- [x] Full `pnpm format` / `lint` / `test` / `build` (`NODE_ENV=production`) / `e2e` **23/23**
- [x] Docs acceptance reports updated
- [ ] **Owner review — then commit (not yet)**

### Nhật ký 2026-08-02 — Final acceptance continuation

- Seeded accounts/customers with session `DEV_SEED_PASSWORD` reset (not committed).
- Auth API: customer1 payments 200 with order/method/amount/status/ref; customer2 isolated; reviews 200 empty CTA.
- Playwright: account-payments-reviews 4/4; address-pickup 3/3; admin RBAC 5/5; full e2e 23/23.
- Media E2E via Docker network PUT (signature Host=minio); by-entity confirms link.
- Fixed lint: admin kho-hang `??` constant; shared-platform dependency-checks deps.
- Fixed unit tests that incorrectly expected FORBIDDEN under always-on vulns.
- Next build: require `NODE_ENV=production` locally.
- VietnamAddressSelector kept off main `@nexatech/shared-web` barrel (import via `libs/shared/web/src/address`).

## Roadmap milestone

| ID | Milestone | Trạng thái |
| -- | --------- | ---------- |
| M0–M21 | Prior milestones | ✅ Done |
| RB | Full re-baseline functional completion | ✅ Local acceptance done — awaiting owner commit |
