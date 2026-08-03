# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Owner manual regression re-audit — **Store Pickup fixed; awaiting owner browser review**
- **Cập nhật lần cuối:** 2026-08-03
- **Branch:** `main` @ `359b8cf` (+ uncommitted pickup/docs — **chưa commit**)
- **Owner gate:** Dừng trước commit / không push

## Re-audit 2026-08-03

### Done

- [x] Pre-flight git + Docker health
- [x] Root-cause Store Pickup (empty Store table + missing Admin CRUD + soft e2e)
- [x] Migration pickup fields; seed `HCM-NGUYEN-HUE`; Admin CRUD; API filter; order validation
- [x] OpenAPI generate/combine/validate — **391 paths**, `stores/pickup`
- [x] Unit tests inventory + order; seed script test; hardened Playwright pickup assertions
- [x] Rebuild inventory/order/admin/storefront; restart persistence OK
- [x] Docs: OWNER-MANUAL-REGRESSION-AUDIT, OWNER-MANUAL-TEST-CHECKLIST, acceptance reports
- [ ] Owner sets `DEV_SEED_PASSWORD` and completes browser checklist
- [ ] Owner review — then commit (not yet)

### Blockers for full PASS_BROWSER

- No `.env` / `DEV_SEED_PASSWORD` on host this session
- Some catalog PDPs still show empty `mediaLinks` (media:audit 8/10 OK)

## Roadmap milestone

| ID | Milestone | Trạng thái |
| -- | --------- | ---------- |
| M0–M21 | Prior milestones | ✅ Done |
| RB | Full re-baseline | ✅ prior local acceptance |
| OM | Owner manual regression | 🔄 Pickup fixed — owner browser pending |
