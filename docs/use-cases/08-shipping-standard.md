# 08 — Standard Shipping Use Cases

Service: `shipping-service`
Prefixes: `/api/v1/shipping/*`, `/api/v1/shipments/*`, `/api/v1/admin/shipments/*`
**Order updates:** REST `POST /api/v1/orders/:orderId/shipping-sync` (Staff+). Outbox publishes `shipping.shipment.*` for notification/reporting.

Shipment statuses: `CREATED`, `QUOTED`, `BOOKED`, `READY_FOR_PICKUP`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `CANCELLED`, `RETURN_TO_SENDER`, `RETURNED`

---

## UC-SHIP-01 — Quote shipping rates

| Field                             | Content                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| **Use case ID**                   | UC-SHIP-01                                                              |
| **Name**                          | Báo giá vận chuyển / Shipping quote                                     |
| **Actor**                         | A01 Guest, A02 Customer                                                 |
| **Supporting actors/services**    | shipping-service mock provider adapter                                  |
| **Preconditions**                 | Destination + parcel dimensions/weight as schema requires               |
| **Trigger**                       | Checkout shipping step                                                  |
| **Input**                         | Quote request body                                                      |
| **Main flow**                     | `POST /shipping/quotes` → store quote → `GET /shipping/quotes/:quoteId` |
| **Alternate flows**               | —                                                                       |
| **Error flows**                   | Validation; provider failure                                            |
| **Authorization**                 | Public / customer as called                                             |
| **Database changes**              | Quote row                                                               |
| **Events produced**               | `shipping.quote.created`                                                |
| **Events consumed**               | None                                                                    |
| **API endpoints**                 | `POST /api/v1/shipping/quotes`, `GET /api/v1/shipping/quotes/:quoteId`  |
| **Response contract**             | Quote DTO                                                               |
| **Idempotency rule**              | None required                                                           |
| **Postconditions**                | QuoteId usable at shipment create                                       |
| **Automated test mapping**        | `shipping.service.spec.ts`, `shipping.controller.spec.ts`               |
| **Current implementation status** | **Implemented**                                                         |
| **Known gaps**                    | Real carrier APIs not integrated (mock provider)                        |

---

## UC-SHIP-02 — Delivery slots reserve / release

| Field                             | Content                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| **Use case ID**                   | UC-SHIP-02                                                                                                  |
| **Name**                          | Giữ slot giao hàng / Delivery slot reserve                                                                  |
| **Actor**                         | A02 Customer                                                                                                |
| **Supporting actors/services**    | shipping-service                                                                                            |
| **Preconditions**                 | Slots available                                                                                             |
| **Trigger**                       | Choose delivery slot                                                                                        |
| **Input**                         | `slotId`; reservation id to release                                                                         |
| **Main flow**                     | `GET /shipping/slots` → `POST /slots/:slotId/reserve` → optional `DELETE /slot-reservations/:reservationId` |
| **Alternate flows**               | —                                                                                                           |
| **Error flows**                   | Slot full/expired                                                                                           |
| **Authorization**                 | Customer headers when required by service                                                                   |
| **Database changes**              | Slot reservation                                                                                            |
| **Events produced**               | `shipping.slot.reserved                                                                                     | released` |
| **Events consumed**               | None                                                                                                        |
| **API endpoints**                 | `/api/v1/shipping/slots`, `/slots/:slotId/reserve`, `/slot-reservations/:reservationId`                     |
| **Response contract**             | Slot/reservation DTOs                                                                                       |
| **Idempotency rule**              | Reserve supports idempotency where contracted                                                               |
| **Postconditions**                | Slot held or released                                                                                       |
| **Automated test mapping**        | shipping specs                                                                                              |
| **Current implementation status** | **Implemented**                                                                                             |
| **Known gaps**                    | —                                                                                                           |

---

## UC-SHIP-03 — Create & book standard shipment

| Field                             | Content                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| **Use case ID**                   | UC-SHIP-03                                                                                                           |
| **Name**                          | Tạo & book đơn vận / Create & book shipment                                                                          |
| **Actor**                         | A02 Customer (create); A03 Staff+ (book)                                                                             |
| **Supporting actors/services**    | shipping-service; A08 Mock Shipping Provider; order shipping-sync                                                    |
| **Preconditions**                 | Order confirmed with STANDARD shipping; packages allocated                                                           |
| **Trigger**                       | Fulfillment booking                                                                                                  |
| **Input**                         | Create shipment body (orderId, packageId, method, quote…); book body + idempotency                                   |
| **Main flow**                     | `POST /shipments` → `POST /shipments/:id/book` → provider booking → sync order via Staff identity → statuses BOOKED+ |
| **Alternate flows**               | Admin transitions                                                                                                    |
| **Error flows**                   | Illegal state; provider error; sync failure (logged; `orderSyncedAt` unset for retry)                                |
| **Authorization**                 | Create owner/customer path; book Staff+                                                                              |
| **Database changes**              | Shipment; outbox; orderSyncedAt                                                                                      |
| **Events produced**               | `shipping.shipment.created                                                                                           | booked | ...` |
| **Events consumed**               | None                                                                                                                 |
| **API endpoints**                 | `POST /api/v1/shipments`, `POST /api/v1/shipments/:shipmentId/book`                                                  |
| **Response contract**             | Shipment DTO                                                                                                         |
| **Idempotency rule**              | Create/book keys; sync key `ship-sync-${shipmentId}-${status}-${version}`                                            |
| **Postconditions**                | Shipment booked; order packages may READY_TO_SHIP/SHIPPED                                                            |
| **Automated test mapping**        | shipping service/controller/state-machine specs                                                                      |
| **Current implementation status** | **Implemented**                                                                                                      |
| **Known gaps**                    | Mock provider only                                                                                                   |

---

## UC-SHIP-04 — Status transitions & tracking (standard)

| Field                             | Content                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-SHIP-04                                                                                                                                                                                                |
| **Name**                          | Cập nhật trạng thái & tracking / Transitions & tracking                                                                                                                                                   |
| **Actor**                         | A03 Staff+; A08 webhook; A01/A02 tracking readers                                                                                                                                                         |
| **Supporting actors/services**    | shipping-service; order REST sync; notification consumer (subset)                                                                                                                                         |
| **Preconditions**                 | Shipment booked                                                                                                                                                                                           |
| **Trigger**                       | Ops transition / provider webhook                                                                                                                                                                         |
| **Input**                         | Target status; webhook payload; trackingCode                                                                                                                                                              |
| **Main flow**                     | `POST /shipments/:id/status-transitions` or `POST /shipping/providers/:provider/webhook` → outbox events → `syncOrder` Staff → public `GET /shipping/tracking/:trackingCode` or `/shipments/:id/tracking` |
| **Alternate flows**               | Admin `POST /admin/shipments/:id/status-transitions`                                                                                                                                                      |
| **Error flows**                   | Illegal transition; DELIVERY_FAILED path                                                                                                                                                                  |
| **Authorization**                 | Transitions Staff+; tracking public by code; get by id owner/staff                                                                                                                                        |
| **Database changes**              | Shipment status/history; order package sync                                                                                                                                                               |
| **Events produced**               | `in-transit`, `out-for-delivery`, `delivered`, `delivery-failed`, `tracking.updated`, …                                                                                                                   |
| **Events consumed**               | None in shipping-service                                                                                                                                                                                  |
| **API endpoints**                 | status-transitions; webhook; tracking GETs; admin list/get/transition                                                                                                                                     |
| **Response contract**             | Shipment / tracking DTOs                                                                                                                                                                                  |
| **Idempotency rule**              | Transition idempotency + orderSyncedAt skip                                                                                                                                                               |
| **Postconditions**                | Shipment & order packages aligned when sync succeeds                                                                                                                                                      |
| **Automated test mapping**        | `shipping-state-machine.spec.ts`, service specs                                                                                                                                                           |
| **Current implementation status** | **Implemented**                                                                                                                                                                                           |
| **Known gaps**                    | notification consumes only a **subset** of shipment events (e.g. out-for-delivery/delivered/delivery-failed)                                                                                              |

---

## UC-SHIP-05 — Cancel shipment

| Field                             | Content                                          |
| --------------------------------- | ------------------------------------------------ |
| **Use case ID**                   | UC-SHIP-05                                       |
| **Name**                          | Hủy vận đơn / Cancel shipment                    |
| **Actor**                         | A02 Customer (owner, early), A03 Staff+          |
| **Supporting actors/services**    | shipping-service; order sync                     |
| **Preconditions**                 | Cancellable status                               |
| **Trigger**                       | Cancel action                                    |
| **Input**                         | `idempotencyKey?`                                |
| **Main flow**                     | `POST /shipments/:id/cancel` → CANCELLED → sync  |
| **Alternate flows**               | —                                                |
| **Error flows**                   | Too late to cancel                               |
| **Authorization**                 | Owner or Staff                                   |
| **Database changes**              | Shipment cancelled                               |
| **Events produced**               | `shipping.shipment.cancelled`                    |
| **Events consumed**               | None                                             |
| **API endpoints**                 | `POST /api/v1/shipments/:shipmentId/cancel`      |
| **Response contract**             | Shipment DTO                                     |
| **Idempotency rule**              | Supported                                        |
| **Postconditions**                | Shipment cancelled; order packages may CANCELLED |
| **Automated test mapping**        | shipping specs                                   |
| **Current implementation status** | **Implemented**                                  |
| **Known gaps**                    | —                                                |

---

## UC-SHIP-06 — Guest / customer tracking by code

| Field                             | Content                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Use case ID**                   | UC-SHIP-06                                                                   |
| **Name**                          | Tra cứu mã vận đơn / Public tracking                                         |
| **Actor**                         | A01 Guest, A02 Customer                                                      |
| **Supporting actors/services**    | shipping-service; storefront BFF `/api/bff/shipping/shipping/tracking/:code` |
| **Preconditions**                 | Tracking code issued                                                         |
| **Trigger**                       | Tracking page                                                                |
| **Input**                         | `trackingCode`                                                               |
| **Main flow**                     | `GET /shipping/tracking/:trackingCode`                                       |
| **Alternate flows**               | Authenticated `GET /shipments/:id/tracking`                                  |
| **Error flows**                   | Unknown code                                                                 |
| **Authorization**                 | Public by code                                                               |
| **Database changes**              | None                                                                         |
| **Events produced**               | None                                                                         |
| **Events consumed**               | None                                                                         |
| **API endpoints**                 | `GET /api/v1/shipping/tracking/:trackingCode`                                |
| **Response contract**             | Tracking timeline DTO                                                        |
| **Idempotency rule**              | N/A                                                                          |
| **Postconditions**                | —                                                                            |
| **Automated test mapping**        | shipping controller specs; storefront bff-path tests                         |
| **Current implementation status** | **Implemented**                                                              |
| **Known gaps**                    | —                                                                            |

---

## Domain summary

| Fact          | Detail                                         |
| ------------- | ---------------------------------------------- |
| Order sync    | REST shipping-sync only                        |
| Events        | Outbox → RabbitMQ `shipment.*`                 |
| STORE_PICKUP  | See [09-store-pickup.md](./09-store-pickup.md) |
| Real carriers | Gap (mock)                                     |
