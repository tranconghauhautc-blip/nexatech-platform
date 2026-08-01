# CUSTOM CHANGES INVENTORY

> Inventory of recent customizations vs original milestone plan. Prefer **runtime + current source** over older docs.
> Status: living — expand during full audit. **No commit in this phase.**

## Table

| File/Area | Thay đổi gần đây | Mục đích | Runtime behavior | Cần giữ | Cần sửa | Rủi ro |
| --- | --- | --- | --- | --- | --- | --- |
| `libs/shared/security-lab` ADR-044 | Always-on vulns; `isSecurityLabEnabled()` always `true` | WAF/API Security PoC | Vulnerable policies always active | Yes | Remove leftover env mention in health/docs; no toggle restore | Over-broad cookie flags broke guest cart |
| `policies.sessionCookieOptions` | `httpOnly:false`, `secure:false`, `sameSite:'none'` | SC-28 cookie misconfig | Browsers may **drop** cookie on HTTP | Keep as intentional vuln for **session** demos | **Do not** apply to `nt_cart_token` (fixed Lax) | Ecommerce break if reused |
| Storefront `env.ts` | Prefer `*_SERVICE_URL` over Kong | BFF reliability | Direct service calls in Docker | Yes | Align docs | Kong bypass for server-side only |
| Storefront `bff-proxy.ts` | Set `nt_cart_token` from `guestCartToken` | Guest cart | Cookie persist | Yes | Done Lax/httpOnly | Token leakage if httpOnly false |
| Cart/Identity `AppErrorFilter` | Map `AppError` → envelope | Fix Nest 500 on 401 | Proper 401 JSON | Yes | Roll out to **all** Nest services | Inconsistent errors until done |
| Catalog facets API | `GET /products/facets` | TGDD-style brand filters | Category-scoped brands | Yes | Document in API-CONTRACTS | — |
| Storefront ProductFilters | Brand list + price chips | UX | Category PLP | Yes | Polish empty states | — |
| Admin `/nguoi-dung` + Identity admin users | Real CRUD vs stub | Admin UX | List/create/patch/disable | Yes | RBAC audit | BOLA lab scenarios nearby |
| PasswordField (admin+storefront) | Eye toggle when value | UX | Works | Yes | — | — |
| Public `/lab/owasp-*.html` | Unauthenticated exploit guides | Quick PoC | Public | Keep until Security Guide auth portal replaces | Move behind auth per new requirements | Public exploit recipes |
| `scripts/seed-inventory.cjs` | Stock all SKUs | Cart/checkout demo | Local only | Yes | Wire into docs/seed story | — |
| Kong `kong.yml` | carts/comparison paths; dedupe admin users | Routing | Healthy after fix | Yes | Validate full path matrix | Duplicate names crash Kong |
| OpenAPI generated files | Mix 3.0.0 / combined 3.0.3; `api.example.invalid` | Docs tooling | Drift | Specs | Force 3.0.3; reorder servers | Tooling import issues |
| Admin login page (uncommitted) | Visible error alert | Wrong-password UX | Pending rebuild | Yes | Verify in browser | — |
| Purchase panel (uncommitted) | Require login for add/buy | Owner UX | Redirect `/dang-nhap?next=...` | Confirm with owner vs guest cart | Guest vs login-required product policy | Conversion vs security-lab guest flows |

## Notes

- Do **not** rollback ADR-044 always-on design.
- Do **not** reintroduce secure/vulnerable dual mode.
- Intentional vulns must remain HTTP-exploitable; unintentional ecommerce bugs must still be fixed.
