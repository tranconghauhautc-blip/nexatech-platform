# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Owner manual regression — **runtime acceptance COMPLETE; awaiting owner review**
- **Cập nhật lần cuối:** 2026-08-03
- **Branch:** `fix/full-runtime-acceptance` @ `8cf5c1b` (+ uncommitted audit/media/e2e/docs)
- **Owner gate:** Dừng trước commit / không push

## Runtime acceptance 2026-08-03 (this session)

### Done

- [x] Checkpoint HEAD `8cf5c1b` treated as immutable (no reset/revert/force-push)
- [x] Admin browser: Admin login; Store CRUD; HCM-NGUYEN-HUE visible; create HN-ACCEPT-01; disable/re-enable; Staff POST **403**; audit row in `/nhat-ky`
- [x] Inventory publishes `audit.recorded` → reporting projection (restart reporting consumer)
- [x] Customer browser/Playwright: customer1 COD pickup order at HCM-NGUYEN-HUE; cart clears; detail shows store; customer2 isolation
- [x] `media:audit` fixed to sample all page products → **10/10 PASS**
- [x] Full gates: format, lint, test, e2e (24), production build, address-data, media:audit, openapi gen/combine/validate (391), security validate/secure/smoke
- [x] Rebuild inventory + reporting; inventory stop/start persistence OK
- [ ] Owner review — then commit (not yet)

### Lab note

- Dev seed passwords were reset this session via `DEV_SEED_RESET_PASSWORD=YES` (operator-defined; not committed). Owner should re-seed with their own `DEV_SEED_PASSWORD` if needed.

## Roadmap milestone

| ID | Milestone | Trạng thái |
| -- | --------- | ---------- |
| M0–M21 | Prior milestones | ✅ Done |
| RB | Full re-baseline | ✅ prior local acceptance |
| OM | Owner manual regression | ✅ runtime acceptance — owner review |
