# FULL SYSTEM AUDIT

> Master audit tracker for NexaTech re-baseline. Sections fill as work proceeds.
> **STOP BEFORE COMMIT** — owner reviews working tree.

## A. Scope status

| Phase | Status |
| --- | --- |
| Git / repo inventory | Done (baseline) |
| Baseline docs | Done |
| Immediate UX bugs (admin login, cart token / login redirect) | Done (uncommitted) |
| AppErrorFilter all Nest services | Done (uncommitted) |
| OpenAPI 3.0.3 standardization | Done generate/validate/diff (regenerated specs) |
| Security Guide auth portal | Scaffold done (`:3200`) — expand scenarios |
| Storefront full browser review | Pending |
| Admin full review | Pending |
| Ecommerce E2E flows A–D | Pending |
| Combined portal polish | Partial (8090 exists) |
| OWASP API vs Web independent audit | Matrices seeded; evidence pending |
| Docker / secret scan / acceptance | Pending |
| Commit / push | **Blocked until owner review** |

## B. Misunderstanding check (OWASP API vs Web)

| Question | Finding so far |
| --- | --- |
| Are API and Web merged into one fake 20/20? | `OWASP-SCENARIOS.md` has **separate** API Top 10:2023 and Web Top 10:2025 matrices; shared scenario IDs may map to both — need evidence that each primary is truly exploitable HTTP |
| Validators count-only? | Need to re-read `security:validate` / scenario tests — mark TBD |
| Public HTML guides | Separate API vs Web files under storefront `/lab/` — unauthenticated (conflicts with new authenticated Security Guide requirement) |

## C. OpenAPI audit snapshot

| Check | Result |
| --- | --- |
| Combined `openapi:` | **3.0.3** |
| 14 service specs `openapi:` | **3.0.3** (forced in normalize + regenerate) |
| Default invalid host | Still listed **last** only |
| Scripts | generate / combine / validate / **diff** / **check** |
| ADR | `docs/adr/ADR-OPENAPI-3-0-3.md` |

## D. Functional smoke (partial — local Docker)

| Area | Result | Notes |
| --- | --- | --- |
| Catalog facets laptop | Pass (API) | Brands Hp/Samsung when seed present |
| Identity wrong password | Pass API 401 | Admin UI feedback was weak — fixing |
| Guest cart cookie | Fail in browser historically | SameSite=None rejected; code fix Lax + require login for PDP actions |
| Add to cart with stock | Pass via BFF after inventory seed | Needs login per new UX |
| Product images | Fail UX | Placeholder letter tiles |
| Security Guide portal | Missing | To build |

## E. Files created this re-baseline wave (so far)

- `docs/CURRENT-PROJECT-BASELINE.md`
- `docs/CUSTOM-CHANGES-INVENTORY.md`
- `docs/FULL-SYSTEM-AUDIT.md` (this file)
- Uncommitted code: admin login UX, purchase login redirect, cart cookie Lax

## F. Explicit non-actions (owner rules)

- No commit / no push
- No `docker compose down -v`
- No migrate reset / volume wipe
- No mass rollback of custom code
