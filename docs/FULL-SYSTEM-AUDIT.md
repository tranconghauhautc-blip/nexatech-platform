# FULL SYSTEM AUDIT

> Master audit tracker for NexaTech re-baseline. Updated 2026-08-01.

## A. Scope status

| Phase | Status |
| --- | --- |
| Git / repo inventory | Done |
| Baseline docs | Done |
| Immediate UX bugs (admin login, cart token / login redirect) | Done |
| AppErrorFilter all Nest services | Done |
| OpenAPI 3.0.3 standardization | Done |
| Security Guide auth portal | Done (`:3200`, auth tests PASSED) |
| OWASP HTML guides behind auth | Done (storefront stubs redirect) |
| Storefront / admin browser E2E | Done (Playwright storefront 7/7, admin RBAC 5/5) |
| Ecommerce checkout smoke | Done (`pnpm checkout:smoke` register→cart→order→COD) |
| Product images | Done (217 placeholder PNGs uploaded via MinIO) |
| Scenario SSoT | Done (36 scenarios; API1–10 + Web A01–A10) |
| Lab smoke | Done (`pnpm lab:smoke` PASSED) |

## B. OWASP API vs Web

Independent matrices in `docs/OWASP-API-2023-MATRIX.md` and `docs/OWASP-WEB-2025-MATRIX.md`. Runtime SSoT: `security-scenarios/scenarios.json`.

## C. OpenAPI

Combined + 14 services forced **3.0.3**. Scripts: generate / combine / validate / diff / check.

## D. Functional smoke (local lab)

| Area | Result |
| --- | --- |
| Catalog facets | Pass |
| Identity wrong password (structured AppError) | Pass |
| Guest cart + buy-now login redirect | Pass |
| Checkout COD | Pass (`checkout:smoke`) |
| Product media upload | Pass (217) |
| Admin 4-role RBAC | Pass |
| Security Guide gate | Pass (302 unauth → login) |

## E. Session cookies vs SC-28

Functional storefront/admin sessions use `HttpOnly` + `SameSite=Lax`. SC-28 insecure flags remain on identity `GET /lab/set-cookie` only.

## F. Explicit non-actions

- No `docker compose down -v` / migrate reset / volume wipe
- No commit of `.env*` secrets or `imports/product-images/` binaries
