# 09 — Store Pickup Use Cases

Method: `STORE_PICKUP` on order/shipment.
Endpoints live on `shipping-service` under `/api/v1/shipments/*` plus inventory commit and order `shipping-sync`.

**Critical rule:** After customer `confirm-pickup`, shipment becomes `DELIVERED` and `syncOrder` **must** use Staff service identity (`serviceSyncActor`). Manual admin `status-transitions` to `DELIVERED` for STORE_PICKUP orders is rejected on order-service — must go through shipping-sync.

---

## UC-PICK-01 — Create STORE_PICKUP shipment

| Field                             | Content                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-PICK-01                                                                                |
| **Name**                          | Tạo vận đơn nhận tại cửa hàng / Create pickup shipment                                    |
| **Actor**                         | A02 Customer / A03 Staff+                                                                 |
| **Supporting actors/services**    | shipping-service; inventory stores/pickup; order packages                                 |
| **Preconditions**                 | Order shipping method STORE_PICKUP; pickup store selected; stock reserved at store source |
| **Trigger**                       | Fulfillment create shipment                                                               |
| **Input**                         | Shipment create with method STORE_PICKUP + storeId/packageId                              |
| **Main flow**                     | `POST /shipments` creates shipment tied to order package                                  |
| **Alternate flows**               | —                                                                                         |
| **Error flows**                   | Wrong method/store                                                                        |
| **Authorization**                 | Owner/staff per create rules                                                              |
| **Database changes**              | Shipment CREATED                                                                          |
| **Events produced**               | `shipping.shipment.created`                                                               |
| **Events consumed**               | None                                                                                      |
| **API endpoints**                 | `POST /api/v1/shipments`                                                                  |
| **Response contract**             | Shipment DTO                                                                              |
| **Idempotency rule**              | Create idempotency key                                                                    |
| **Postconditions**                | Pickup shipment exists                                                                    |
| **Automated test mapping**        | `shipping.service.spec.ts`                                                                |
| **Current implementation status** | **Implemented**                                                                           |
| **Known gaps**                    | —                                                                                         |

---

## UC-PICK-02 — Mark ready for pickup (issue code)

| Field                             | Content                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-PICK-02                                                                                                                                                  |
| **Name**                          | Sẵn sàng nhận hàng / Ready for pickup                                                                                                                       |
| **Actor**                         | A03 Staff+                                                                                                                                                  |
| **Supporting actors/services**    | shipping-service; order shipping-sync                                                                                                                       |
| **Preconditions**                 | Shipment in bookable/ready pipeline for pickup                                                                                                              |
| **Trigger**                       | Staff marks order ready at store                                                                                                                            |
| **Input**                         | Optional `idempotencyKey`                                                                                                                                   |
| **Main flow**                     | `POST /shipments/:id/ready-for-pickup` → generate pickup code once (hash + hint) → status `READY_FOR_PICKUP` → sync order package `READY_TO_SHIP` via Staff |
| **Alternate flows**               | Re-call idempotent if already ready                                                                                                                         |
| **Error flows**                   | Forbidden non-staff; illegal status                                                                                                                         |
| **Authorization**                 | `requireStaff`                                                                                                                                              |
| **Database changes**              | Pickup code hash/hint; shipment status                                                                                                                      |
| **Events produced**               | `shipping.shipment.ready-for-pickup`                                                                                                                        |
| **Events consumed**               | None                                                                                                                                                        |
| **API endpoints**                 | `POST /api/v1/shipments/:shipmentId/ready-for-pickup`                                                                                                       |
| **Response contract**             | Shipment DTO (+ code hint as designed; full code channel-dependent)                                                                                         |
| **Idempotency rule**              | Supported; code generated once                                                                                                                              |
| **Postconditions**                | Customer can confirm with code                                                                                                                              |
| **Automated test mapping**        | shipping service specs                                                                                                                                      |
| **Current implementation status** | **Implemented**                                                                                                                                             |
| **Known gaps**                    | Delivery of plaintext code to customer channel may rely on notification subset / ops                                                                        |

---

## UC-PICK-03 — Customer confirm pickup

| Field                             | Content                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-PICK-03                                                                                                                                                                                                                                                                                                             |
| **Name**                          | Khách xác nhận đã nhận / Confirm pickup                                                                                                                                                                                                                                                                                |
| **Actor**                         | A02 Customer (owner)                                                                                                                                                                                                                                                                                                   |
| **Supporting actors/services**    | shipping-service; inventory-service commit; order-service shipping-sync                                                                                                                                                                                                                                                |
| **Preconditions**                 | Status `READY_FOR_PICKUP`; customer knows pickup code; order STORE_PICKUP                                                                                                                                                                                                                                              |
| **Trigger**                       | Customer enters pickup code                                                                                                                                                                                                                                                                                            |
| **Input**                         | `{ pickupCode, idempotencyKey? }`                                                                                                                                                                                                                                                                                      |
| **Main flow**                     | 1) Verify hash 2) Reject if not STORE_PICKUP 3) Commit inventory via Staff inventory client 4) Jump shipment `READY_FOR_PICKUP → DELIVERED` (outbox may emit PICKED_UP + DELIVERED) 5) `syncOrder` with **`serviceSyncActor` (roles Staff)** 6) Order `doSyncShipping` multi-step promotes packages/order to DELIVERED |
| **Alternate flows**               | Retry if sync fails (`rethrow: true` on confirm path; `orderSyncedAt` unset)                                                                                                                                                                                                                                           |
| **Error flows**                   | Bad code; wrong status; non-owner; inventory commit failure                                                                                                                                                                                                                                                            |
| **Authorization**                 | Customer owner for confirm; **sync always Staff service identity** (not customer roles)                                                                                                                                                                                                                                |
| **Database changes**              | Shipment DELIVERED; inventory committed; order/packages DELIVERED; outbox                                                                                                                                                                                                                                              |
| **Events produced**               | `picked-up`, `delivered` (and related)                                                                                                                                                                                                                                                                                 |
| **Events consumed**               | None                                                                                                                                                                                                                                                                                                                   |
| **API endpoints**                 | `POST /api/v1/shipments/:shipmentId/confirm-pickup` · order `POST /api/v1/orders/:orderId/shipping-sync`                                                                                                                                                                                                               |
| **Response contract**             | Shipment DTO                                                                                                                                                                                                                                                                                                           |
| **Idempotency rule**              | Confirm key + orderSyncedAt                                                                                                                                                                                                                                                                                            |
| **Postconditions**                | Goods handed over; stock committed; order delivered                                                                                                                                                                                                                                                                    |
| **Automated test mapping**        | `shipping.service.spec.ts` comment `UC-SHIP / P0: confirmPickup must sync order with Staff service identity`; `order.service.spec.ts` STORE_PICKUP multi-step                                                                                                                                                          |
| **Current implementation status** | **Implemented**                                                                                                                                                                                                                                                                                                        |
| **Known gaps**                    | Historical P0 (customer roles on sync) fixed; payment COD auto-collect on delivered still unwired                                                                                                                                                                                                                      |

---

## UC-PICK-04 — Block illegal direct DELIVERED transitions

| Field                             | Content                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-PICK-04                                                                                                                     |
| **Name**                          | Chặn DELIVERED thủ công cho pickup / Guard STORE_PICKUP DELIVERED                                                              |
| **Actor**                         | A03 Staff+                                                                                                                     |
| **Supporting actors/services**    | order-service status-transitions; shipping status machine                                                                      |
| **Preconditions**                 | STORE_PICKUP order                                                                                                             |
| **Trigger**                       | Admin tries manual order DELIVERED or illegal shipment shortcut                                                                |
| **Input**                         | Status transition request                                                                                                      |
| **Main flow**                     | Order admin `status-transitions` **always rejects** STORE_PICKUP → DELIVERED; must use shipping-sync path after confirm-pickup |
| **Alternate flows**               | Use UC-PICK-03                                                                                                                 |
| **Error flows**                   | Explicit rejection error                                                                                                       |
| **Authorization**                 | Staff+                                                                                                                         |
| **Database changes**              | None on reject                                                                                                                 |
| **Events produced**               | None                                                                                                                           |
| **Events consumed**               | None                                                                                                                           |
| **API endpoints**                 | `POST /api/v1/admin/orders/:orderId/status-transitions`                                                                        |
| **Response contract**             | Error envelope                                                                                                                 |
| **Idempotency rule**              | N/A                                                                                                                            |
| **Postconditions**                | Invariant preserved                                                                                                            |
| **Automated test mapping**        | `order.service.spec.ts` fulfillment-guard tests                                                                                |
| **Current implementation status** | **Implemented**                                                                                                                |
| **Known gaps**                    | Pre-fix stale rows may need `reconcile-fulfillment` / CLI                                                                      |

---

## UC-PICK-05 — Reconcile stale pickup fulfillment

| Field                             | Content                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-PICK-05                                                                                     |
| **Name**                          | Đối soát fulfillment / Reconcile fulfillment                                                   |
| **Actor**                         | A05 Admin+, A10 Job/CLI                                                                        |
| **Supporting actors/services**    | order-service; `scripts/reconcile-order-fulfillment.mjs`                                       |
| **Preconditions**                 | Order already DELIVERED with stale packages (legacy)                                           |
| **Trigger**                       | Admin reconcile or CLI                                                                         |
| **Input**                         | `orderId` / order codes                                                                        |
| **Main flow**                     | `POST /admin/orders/:orderId/reconcile-fulfillment` idempotent audited; no-op unless DELIVERED |
| **Alternate flows**               | CLI batch                                                                                      |
| **Error flows**                   | Forbidden non-admin                                                                            |
| **Authorization**                 | Admin+                                                                                         |
| **Database changes**              | Package alignment when applicable                                                              |
| **Events produced**               | Audit as implemented                                                                           |
| **Events consumed**               | None                                                                                           |
| **API endpoints**                 | `POST /api/v1/admin/orders/:orderId/reconcile-fulfillment`                                     |
| **Response contract**             | Reconcile result                                                                               |
| **Idempotency rule**              | Idempotent                                                                                     |
| **Postconditions**                | Packages match delivered order when fix applies                                                |
| **Automated test mapping**        | `order.service.spec.ts` reconcile tests                                                        |
| **Current implementation status** | **Implemented**                                                                                |
| **Known gaps**                    | Owner may still need to run CLI on legacy RC data                                              |

---

## Domain summary

| Item                         | Status                                 |
| ---------------------------- | -------------------------------------- |
| Staff sync on confirm-pickup | **Implemented** (`serviceSyncActor`)   |
| Multi-step order promotion   | **Implemented**                        |
| Manual DELIVERED blocked     | **Implemented**                        |
| P0 Staff header              | Fixed (was Gap)                        |
| Payment sync Staff on mock   | **Implemented** (`serviceSyncHeaders`) |
