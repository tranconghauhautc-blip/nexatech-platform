# Real Business Workflow Acceptance

**Date:** 2026-08-03  
**Rule:** Admin/Customer UI → Kong/API → owning service → PostgreSQL/MinIO → events → dependent reads. No SQL writes for acceptance business data.

## Implemented paths ready for owner execution

1. **Catalog sync** — Admin categories → Storefront nav (verified HTML).
2. **Spec management** — Admin can open/edit/delete templates; product can persist specs via PATCH.
3. **Media** — Presign → browser PUT → confirm → link; primary/unlink catalog APIs; media:audit PASS.
4. **Inventory Admin** — UI calls `admin/inventory/stock/receive|issue|adjust` with idempotency keys.
5. **Availability** — Storefront BFF → inventory `stock/availability` (empty until stock initialized).
6. **Cart/checkout** — Existing cart-service + order-service flows retained; qty clamp added.
7. **Customer account** — Overview cards, profile/address CRUD, recently-viewed persistence, eligibility UX for warranty/reviews.

## Deferred to owner-operated browser (credentials + data mutation)

| Phase                                | Status                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| A stock init HN=10 / HCM=5           | UI ready; DB stock empty                                                     |
| B COD delivery reservation           | Blocked on stock                                                             |
| C pickup + cancel release            | Blocked on stock                                                             |
| D double-click / restart persistence | Partial: Docker recreate of services done without data loss of catalog/media |

## Idempotency

- Inventory receive/adjust require `idempotencyKey`; Admin UI generates fresh UUID per submit and disables button while pending.
- Order/checkout idempotency remains in order-service (pre-existing).

## Isolation

- Customer address/profile scoped by `userId` (customer-service tests cover delete + default reassignment).
- Wishlist/compare/recently-viewed via cart-service per authenticated user.
