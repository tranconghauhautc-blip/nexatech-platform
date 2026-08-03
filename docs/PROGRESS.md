# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Local RC — Final full-system defect sweep — **STOP for owner review**
- **Cập nhật lần cuối:** 2026-08-03
- **Branch:** `fix/media-upload-profile-minimal-reset` @ `92689d5` (+ uncommitted RC changes)
- **Owner gate:** Không commit / không push

## Done this sweep

- [x] Defect ledger `docs/FINAL-LOCAL-RC-DEFECT-LEDGER.md`
- [x] DEF-001 inventory commit on pickup/fulfilil (shipping → inventory REST commit)
- [x] DEF-002 stock HN-MAIN=10, HCM-NGUYEN-HUE=5 proven after container recreate
- [x] DEF-003/006 compare + recently-viewed hydrate
- [x] DEF-004 support Customer + Admin detail/reply
- [x] DEF-005 SKU PATCH + Admin edit name
- [x] DEF-007/008 Admin ops + movements
- [x] DEF-009/010/011 PDP price, forms, spec labels
- [x] Rebuild Docker: catalog, inventory, shipping, admin-web, storefront-web
- [x] Gates: format:check PASS; lint PASS (warnings only); unit tests PASS; host builds PASS; openapi:validate PASS; media:audit PASS; security:validate PASS
- [x] Browser PDP: in-stock 15, real PNG, RAM/Storage labels

## Owner must still execute (manual with credentials)

- [ ] Full Customer 1 COD standard-delivery order → Admin fulfil → prove single commit consumption
- [ ] Customer 2 pickup at HCM-NGUYEN-HUE → cancel → prove single release
- [ ] Double-click / concurrency oversell checks
- [ ] DEF-019 notification generation proof after real orders
- [ ] Review remaining MEDIUM: returns UI, guest add-to-cart policy, UUID tooltips

## Safety

- No DB reset / MinIO clear / Redis flush / RabbitMQ purge / commit / push
- Owner runtime categories, brand, warehouse, store, product, media preserved
