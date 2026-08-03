# ADMIN FUNCTIONAL ACCEPTANCE

> **2026-08-03** owner regression. Store/warehouse CRUD fixed.

| Module | Verdict | Evidence |
| ------ | ------- | -------- |
| 4-role login/RBAC menu | PARTIAL this pass | Prior Playwright PASS; this host no seed password |
| Route guard unauth | PASS_BROWSER | `/cua-hang-kho` → unauthorized 401 UI |
| Products price | PASS_API_ONLY | Kong minPrice > 0 |
| Orders orderCode / pickup badge | PASS source | Pickup empty packages message fixed for STORE_PICKUP |
| **Stores/Warehouses CRUD** | **PASS_RUNTIME API/DB** | Tabs + create/edit; Manager+ API; Staff 403; seed HCM-NGUYEN-HUE; HN-MAIN untouched |
| Inventory location name | PASS source | — |
| Reporting | PASS_API_ONLY | health / 401 dashboard |
| Users ops (no hash column) | PASS source | Lab leak kept |
| Media upload/link | PARTIAL | media:audit PASS; browser upload NOT_TESTED |
| Audit projection | PARTIAL | store create writes local audit |

## RBAC — Stores

| Action | Staff | Manager | Admin | SuperAdmin |
| ------ | ----- | ------- | ----- | ---------- |
| View list | ✅ | ✅ | ✅ | ✅ |
| Create/update store/warehouse | ❌ API 403 | ✅ | ✅ | ✅ |
| Toggle pickupEnabled / isActive | ❌ | ✅ | ✅ | ✅ |

See `docs/ADMIN-RBAC-MATRIX.md`.
