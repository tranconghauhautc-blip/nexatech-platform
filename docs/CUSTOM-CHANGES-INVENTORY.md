# CUSTOM CHANGES INVENTORY

> Inventory of recent customizations vs original milestone plan. Prefer **runtime + current source** over older docs.
> Updated **2026-08-02** during full re-baseline. **No commit in this phase.**

## Table

| File/Area                                  | Custom gần đây                                      | Mục đích                     | Runtime behavior                  | Cần giữ                                        | Cần sửa                             | Rủi ro                                             |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------- | --------------------------------- | ---------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `libs/shared/security-lab` ADR-044         | Always-on vulns; `isSecurityLabEnabled()` → `true`  | WAF/API Security PoC         | Vulnerable policies always active | **Yes**                                        | Do not restore dual mode            | Ecommerce breakage if misapplied                   |
| Session cookie SC-28                       | `httpOnly:false`, `secure:false`, `sameSite:'none'` | Intentional cookie misconfig | Browser may drop on HTTP          | Keep for **session** demos                     | Do **not** apply to `nt_cart_token` | Guest cart broke before Lax fix                    |
| Storefront cart cookie                     | `SameSite=Lax` for `nt_cart_token`                  | Guest cart works on HTTP     | Cookie persists                   | Yes                                            | —                                   | —                                                  |
| AppErrorFilter (14 Nest)                   | Map `AppError` → envelope                           | Proper 401/4xx JSON          | Consistent errors                 | Yes                                            | —                                   | —                                                  |
| Catalog facets API                         | `GET /products/facets`                              | TGDD-style brand filters     | Category-scoped brands            | Yes                                            | —                                   | —                                                  |
| Admin `/nguoi-dung` + Identity admin users | Real CRUD + **Lab leak column**                     | Admin UX + SC leak PoC       | List shows hash prefix            | Keep leak **scenario**; remove from ops column | In progress                         | Confusing ops UI                                   |
| Security Guide portal `:3200`              | Auth-gated OWASP HTML                               | Training                     | Recipes behind login              | Yes                                            | —                                   | —                                                  |
| OpenAPI 3.0.3 force                        | generate/combine/validate/diff/check                | Spec compliance              | Combined 3.0.3                    | Yes                                            | Regenerate after new endpoints      | Drift                                              |
| `pnpm seed:customers`                      | customer1/customer2                                 | Storefront lab               | Idempotent local-only             | Yes                                            | —                                   | —                                                  |
| Product image import                       | `import:product-images` + placeholders              | Lab visuals                  | MinIO objects                     | Yes                                            | Complete admin upload UI            | Orphans                                            |
| Combined Swagger portal `:8090`            | Kong `/docs`                                        | Lab Try-it-out               | Healthy                           | Yes                                            | —                                   | —                                                  |
| Checkout pickup `storeId` text             | Legacy UI                                           | Was raw UUID input           | **Broken UX**                     | No                                             | Replaced with store selector        | Was using wrong field `storeId` vs `pickupStoreId` |
| Payment history `GET /payments`            | Frontend called missing list                        | 404                          | **Fixed** → `/payments/me`        | Keep customer-scoped                           | Rebuild payment image               | —                                                  |
| Admin order `code` column                  | Field mismatch                                      | Shows `—`                    | **Fixed** → `orderCode`           | —                                              | Rebuild admin image                 | —                                                  |
| Catalog `Math.min(..., 0)`                 | Bug                                                 | Always price 0               | **Fixed** in source               | —                                              | Rebuild catalog image               | —                                                  |

## Notes

- Do **not** rollback ADR-044 always-on design.
- Do **not** reintroduce secure/vulnerable dual mode.
- Intentional vulns must remain HTTP-exploitable; unintentional ecommerce bugs must still be fixed.
- Priority of truth: runtime → source → HTTP/browser → DB → Git → tests → docs.
