# CUSTOMER-ADMIN FULL AUDIT

> Full functional audit started **2026-08-02**. Update as fixes land. **No commit yet.**

## A. Customer defects (observed → root cause → action)

| #   | Observation                           | Root cause                                  | Action                                               |
| --- | ------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| 1   | Payment `Cannot GET /api/v1/payments` | No list handler; only POST/by-order/:id/:id | Added `GET /payments/me` + storefront `/payments/me` |
| 2   | Reviews empty → error                 | `GET /reviews/me` missing                   | Added listMyReviews + empty CTA                      |
| 3   | Wishlist raw UUID                     | Wishlist stores productId only              | Hydrate via `GET /products/summaries`                |
| 4   | Pickup raw storeId                    | Free-text UUID + wrong field name `storeId` | Store selector cards + `pickupStoreId`               |
| 5   | Cart badge after checkout             | Result page no refresh                      | `refresh()` on success + result page                 |
| 6   | Order detail thin                     | UI used `code`; ignored items/address       | Full detail with items/address/pickup                |
| 7   | Warranty/Support empty CTA            | Only "home" link                            | Create forms + CTAs                                  |
| 8   | Address free-text                     | No VN admin dataset                         | Dataset + selector (in progress)                     |
| 9   | Compare / recently viewed             | Need runtime verify                         | Pending E2E                                          |

## B. Admin defects

| #   | Observation                      | Root cause                             | Action                           |
| --- | -------------------------------- | -------------------------------------- | -------------------------------- |
| 1   | Product price 0 ₫                | `Math.min(..., 0)`                     | Fixed catalog repository         |
| 2   | Order number —                   | UI `code` vs API `orderCode`           | Fixed column                     |
| 3   | Media Entity ID                  | Lookup-only UI                         | Entity selector + upload (agent) |
| 4   | Inventory UUID                   | No name join                           | Map warehouses/stores (agent)    |
| 5   | Shipment missing after CONFIRMED | No auto-create consumer                | Explicit create / admin action   |
| 6   | Reports —                        | Field key mismatch                     | Fix mapping (agent)              |
| 7   | Audit empty                      | Few `AUDIT_RECORDED` events            | Wire projection publishers       |
| 8   | LAB LEAK ops column              | Intentional but misplaced in ops table | Move to scenario view; keep PoC  |
| 9   | Product CRUD incomplete          | List-heavy UI                          | Complete create/edit/detail      |
| 10  | Image E2E                        | Presign exists; admin UI incomplete    | Complete pipeline                |

## C. Security compatibility

- Always-on vulns preserved (ADR-044).
- Operational fixes must not remove scenario routes/extensions.
- Upload operational path ≠ vulnerable upload scenario.

## D. Next dependency order

Address dataset → rebuild affected Docker images → OpenAPI regen → Playwright → media E2E → reports.
