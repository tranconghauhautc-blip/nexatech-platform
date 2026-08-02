# ADMIN FUNCTIONAL ACCEPTANCE

> 2026-08-02 final local acceptance.

| Module | Verdict | Evidence |
| ------ | ------- | -------- |
| 4-role login/RBAC menu | PASS | Playwright 5/5 |
| Route guard unauth | PASS | admin smoke |
| Products price | PASS | catalog Math.min fix; runtime VND |
| Orders orderCode | PASS | UI mapping |
| Inventory location name | PASS | source UI |
| Reporting field map | PASS | source UI |
| Users ops (no hash column) | PASS | source; Lab leak endpoint kept |
| Media upload/link | PASS | Admin UI + `pnpm media:e2e` |
| Audit projection | PARTIAL | some AUDIT_RECORDED; not fully projected |

See also `docs/ADMIN-RBAC-MATRIX.md`.
