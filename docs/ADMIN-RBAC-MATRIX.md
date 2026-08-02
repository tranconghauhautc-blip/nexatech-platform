# Admin RBAC Matrix

> Living matrix **2026-08-02**. Enforce on API + UI (not menu-hide only).

| Capability                           | Staff        | Manager  | Admin      | SuperAdmin |
| ------------------------------------ | ------------ | -------- | ---------- | ---------- |
| Dashboard view                       | ✅           | ✅       | ✅         | ✅         |
| Catalog list                         | ✅           | ✅       | ✅         | ✅         |
| Catalog mutate (product/price/media) | ❌ / limited | ✅       | ✅         | ✅         |
| Inventory adjust/transfer            | ❌ / limited | ✅       | ✅         | ✅         |
| Order confirm / status workflow      | ✅ limited   | ✅       | ✅         | ✅         |
| Payment COD collect / refund         | ❌           | ✅       | ✅         | ✅         |
| Shipping create/book                 | ❌           | ✅       | ✅         | ✅         |
| Review moderate                      | ✅           | ✅       | ✅         | ✅         |
| Warranty/Support workflow            | ✅           | ✅       | ✅         | ✅         |
| Reporting                            | ❌           | ✅       | ✅         | ✅         |
| Audit logs                           | ❌           | ✅       | ✅         | ✅         |
| Users create/disable/role            | ❌           | ❌       | ✅ limited | ✅         |
| Security lab pages                   | lab only     | lab only | lab only   | lab only   |

## Acceptance

- Sidebar visibility matches role.
- Direct route access returns unauthorized/forbidden UI.
- API returns 401/403 for unauthorized mutations.
- Playwright: `e2e/admin/rbac-roles.spec.ts` (4 roles).

## Notes

- Intentional BFLA/BOLA scenarios remain always-on for Security Guide PoCs — separate from operational RBAC matrix.
- Do not use operational UI to demonstrate password-hash leak; use scenario endpoint/detail only.
