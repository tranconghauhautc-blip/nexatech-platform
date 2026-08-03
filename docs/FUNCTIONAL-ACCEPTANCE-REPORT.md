# FUNCTIONAL ACCEPTANCE REPORT

> **2026-08-03** — Full runtime acceptance after Store Pickup checkpoint.
> Checkpoint HEAD: `8cf5c1b`. Branch `fix/full-runtime-acceptance`. **No commit / no push.**

## Evidence levels

| Level | Meaning |
| ----- | ------- |
| PASS_RUNTIME | Live Docker + DB + API (+ restart where noted) |
| PASS_BROWSER | Browser/Playwright against Compose UI with real session |
| PASS_API_ONLY | Authenticated or public API shape OK; browser not required for claim |
| PARTIAL | Works with known gaps |
| FAIL / MISSING_DATA / NOT_TESTED | As named |

## Gates (all exit 0)

| Gate | Result |
| ---- | ------ |
| format | PASS |
| lint | PASS |
| test | PASS (Nx 27 projects) |
| e2e | PASS **24** (incl. pickup COD + rbac 4 roles) |
| `NODE_ENV=production` build | PASS |
| address-data:validate | PASS 34 provinces / 3321 wards |
| media:audit | PASS **10/10** |
| openapi:generate/combine/validate | PASS **391** paths, 3.0.3 |
| security:validate / test:secure / smoke | PASS |

## Module matrix (honest)

| Area | Result |
| ---- | ------ |
| Admin login (Admin/Manager/SuperAdmin/Staff) | PASS_BROWSER |
| Admin store CRUD + HCM-NGUYEN-HUE | PASS_BROWSER |
| Store disable/re-enable | PASS_BROWSER + PASS_API_ONLY |
| Staff store mutation | PASS_API_ONLY **403** |
| Audit Nhật ký | PASS_BROWSER (`inventory.store.updated`) |
| Pickup API Kong/direct | PASS_RUNTIME |
| Inventory restart persistence | PASS_RUNTIME |
| Customer1 login + cart + pickup COD | PASS_BROWSER |
| Order detail store hydrate | PASS_BROWSER |
| customer2 isolation | PASS_BROWSER |
| Product media sample | PASS_RUNTIME (media:audit 10/10) |
| VN address data | PASS_RUNTIME (validate) |

## Follow-ups for owner

1. Review UI manually with own `DEV_SEED_PASSWORD` (session used a local reset; not committed).
2. Approve commit of audit projection + media:audit + pickup COD e2e + docs.
3. Optional: deactivate test store `HN-ACCEPT-01` if not desired in lab pickup list.
