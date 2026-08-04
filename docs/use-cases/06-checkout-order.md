# 06 — Checkout & Order Use Cases

Service: `order-service`
Prefixes: `/api/v1/orders/*`, `/api/v1/admin/orders/*`
**Critical:** payment/shipping/return sync are **REST Staff+**, not RabbitMQ consumers on order-service.

Order statuses: `PENDING`, `AWAITING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `READY_TO_SHIP`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`, `FAILED`

Package statuses: `PENDING`, `ALLOCATED`, `READY_TO_SHIP`, `SHIPPED`, `DELIVERED`, `CANCELLED`

---

## UC-ORD-01 — Create order (checkout)

| Field                             | Content                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-01                                                                                                                                                                               |
| **Name**                          | Đặt hàng / Create order                                                                                                                                                                 |
| **Actor**                         | A02 Customer                                                                                                                                                                            |
| **Supporting actors/services**    | order-service; inventory reserve; catalog SKU snapshot; cart convert; optional shipping quote                                                                                           |
| **Preconditions**                 | Validated cart; address or pickup store; payment method chosen                                                                                                                          |
| **Trigger**                       | Confirm checkout                                                                                                                                                                        |
| **Input**                         | Create order body (items, shipping method STANDARD/STORE_PICKUP, payment method, address/store, `idempotencyKey`)                                                                       |
| **Main flow**                     | Validate → snapshot items (`imageMediaId` from catalog thumbnail) → reserve inventory → create Order + Packages → outbox `order.order.created` → status `PENDING` or `AWAITING_PAYMENT` |
| **Alternate flows**               | COD vs online payment initial status; multi-package split when sources differ                                                                                                           |
| **Error flows**                   | Insufficient stock; invalid SKU; validation                                                                                                                                             |
| **Authorization**                 | Customer `x-user-id`                                                                                                                                                                    |
| **Database changes**              | Order, OrderItem, Package, Outbox, Idempotency                                                                                                                                          |
| **Events produced**               | `order.order.created` (+ package events as applicable)                                                                                                                                  |
| **Events consumed**               | None                                                                                                                                                                                    |
| **API endpoints**                 | `POST /api/v1/orders`                                                                                                                                                                   |
| **Response contract**             | Order detail DTO                                                                                                                                                                        |
| **Idempotency rule**              | `idempotencyKey` via `maybeIdempotent` / `withIdempotency`                                                                                                                              |
| **Postconditions**                | Stock reserved; order readable by customer                                                                                                                                              |
| **Automated test mapping**        | `order.service.spec.ts`, `order.controller.spec.ts`, concurrency/integration specs                                                                                                      |
| **Current implementation status** | **Implemented**                                                                                                                                                                         |
| **Known gaps**                    | Runtime RC may have empty `Order` table (operational); no invoice PDF                                                                                                                   |

---

## UC-ORD-02 — List / get my orders & packages

| Field                             | Content                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-02                                                                                                     |
| **Name**                          | Xem đơn hàng của tôi / List & get orders                                                                      |
| **Actor**                         | A02 Customer                                                                                                  |
| **Supporting actors/services**    | order-service; storefront order pages                                                                         |
| **Preconditions**                 | Orders exist for user                                                                                         |
| **Trigger**                       | Account orders                                                                                                |
| **Input**                         | Optional filters; `:orderId`                                                                                  |
| **Main flow**                     | `GET /orders`, `GET /orders/:orderId`, `GET /orders/:orderId/packages`, `GET /orders/:orderId/status-history` |
| **Alternate flows**               | Empty list                                                                                                    |
| **Error flows**                   | Not owner → forbidden/not found                                                                               |
| **Authorization**                 | Owner customer                                                                                                |
| **Database changes**              | None                                                                                                          |
| **Events produced**               | None                                                                                                          |
| **Events consumed**               | None                                                                                                          |
| **API endpoints**                 | `GET /api/v1/orders`, `/:orderId`, `/:orderId/packages`, `/:orderId/status-history`                           |
| **Response contract**             | Order / package / history DTOs                                                                                |
| **Idempotency rule**              | N/A                                                                                                           |
| **Postconditions**                | —                                                                                                             |
| **Automated test mapping**        | order controller/service specs                                                                                |
| **Current implementation status** | **Implemented**                                                                                               |
| **Known gaps**                    | Empty Orders table in some RC DBs                                                                             |

---

## UC-ORD-03 — Customer cancel / confirm

| Field                             | Content                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-03                                                                          |
| **Name**                          | Hủy / xác nhận đơn (khách) / Customer cancel & confirm                             |
| **Actor**                         | A02 Customer                                                                       |
| **Supporting actors/services**    | order-service; inventory release on cancel                                         |
| **Preconditions**                 | Order in cancellable early status for cancel                                       |
| **Trigger**                       | Cancel / confirm actions                                                           |
| **Input**                         | `{ reason?, idempotencyKey? }`                                                     |
| **Main flow**                     | Cancel → release reservations → `CANCELLED`; Confirm when allowed by state machine |
| **Alternate flows**               | Staff admin cancel/confirm endpoints                                               |
| **Error flows**                   | Illegal transition                                                                 |
| **Authorization**                 | Owner                                                                              |
| **Database changes**              | Order status history; inventory release side-effect                                |
| **Events produced**               | `order.order.cancelled` / confirmed events                                         |
| **Events consumed**               | None                                                                               |
| **API endpoints**                 | `POST /api/v1/orders/:orderId/cancel`, `.../confirm`                               |
| **Response contract**             | Order DTO                                                                          |
| **Idempotency rule**              | Optional idempotency key                                                           |
| **Postconditions**                | Terminal or next status applied                                                    |
| **Automated test mapping**        | `order-state-machine.spec.ts`, `order.service.spec.ts`                             |
| **Current implementation status** | **Implemented**                                                                    |
| **Known gaps**                    | Payment `handleOrderCancelled` not wired to Rabbit consumer                        |

---

## UC-ORD-04 — Payment sync (inter-service)

| Field                             | Content                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-04                                                                                                            |
| **Name**                          | Đồng bộ thanh toán → đơn / Payment sync                                                                              |
| **Actor**                         | A03 Staff+ (service identity expected)                                                                               |
| **Supporting actors/services**    | payment-service → order-service REST                                                                                 |
| **Preconditions**                 | Order exists; payment lifecycle advanced                                                                             |
| **Trigger**                       | Payment paid/failed/COD collected                                                                                    |
| **Input**                         | `syncOrderPaymentRequestSchema`: `paymentStatus`, `paymentReference?`, `paidAt?`, `confirmOrder?`, `idempotencyKey?` |
| **Main flow**                     | `POST /orders/:orderId/payment-sync` → update payment fields; optionally `AWAITING_PAYMENT → CONFIRMED`              |
| **Alternate flows**               | COD `confirmOrder: false`                                                                                            |
| **Error flows**                   | Non-staff → FORBIDDEN; illegal state                                                                                 |
| **Authorization**                 | `requireStaff`                                                                                                       |
| **Database changes**              | Order payment status / confirm transition; outbox                                                                    |
| **Events produced**               | Order status/confirm events as applicable                                                                            |
| **Events consumed**               | None                                                                                                                 |
| **API endpoints**                 | `POST /api/v1/orders/:orderId/payment-sync`                                                                          |
| **Response contract**             | Order DTO                                                                                                            |
| **Idempotency rule**              | Idempotency key / replay                                                                                             |
| **Postconditions**                | Order payment fields consistent with payment-service                                                                 |
| **Automated test mapping**        | `order.service.spec.ts`                                                                                              |
| **Current implementation status** | **Implemented** (endpoint) / **Partial** (callers)                                                                   |
| **Known gaps**                    | Mock payment may forward Customer roles → FORBIDDEN swallowed in payment-service                                     |

---

## UC-ORD-05 — Shipping sync (inter-service)

| Field                             | Content                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------- |
| **Use case ID**                   | UC-ORD-05                                                                                                                                                                                            |
| **Name**                          | Đồng bộ vận chuyển → đơn / Shipping sync                                                                                                                                                             |
| **Actor**                         | A03 Staff+ (shipping-service uses `serviceSyncActor`)                                                                                                                                                |
| **Supporting actors/services**    | shipping-service REST client; **not** Rabbit consumer                                                                                                                                                |
| **Preconditions**                 | Order + package exist                                                                                                                                                                                |
| **Trigger**                       | Shipment status / tracking updates                                                                                                                                                                   |
| **Input**                         | `packageId`, `shipmentId`, optional tracking/provider/`packageStatus`/`orderStatus`/`idempotencyKey`                                                                                                 |
| **Main flow**                     | Update package; promote order SHIPPED/DELIVERED per rules; STORE_PICKUP multi-step `READY_TO_SHIP → SHIPPED → DELIVERED` in one call when needed; package updates decoupled from failed status hints |
| **Alternate flows**               | Idempotent same-package dedup                                                                                                                                                                        |
| **Error flows**                   | Non-staff FORBIDDEN; illegal package transition                                                                                                                                                      |
| **Authorization**                 | `requireStaff`                                                                                                                                                                                       |
| **Database changes**              | Package + Order + history + outbox                                                                                                                                                                   |
| **Events produced**               | `order.order.shipped                                                                                                                                                                                 | delivered | ...` as transitions apply |
| **Events consumed**               | **None** (REST only)                                                                                                                                                                                 |
| **API endpoints**                 | `POST /api/v1/orders/:orderId/shipping-sync`                                                                                                                                                         |
| **Response contract**             | Order DTO                                                                                                                                                                                            |
| **Idempotency rule**              | Key + internal samePackage dedup                                                                                                                                                                     |
| **Postconditions**                | Package/order align with shipment                                                                                                                                                                    |
| **Automated test mapping**        | `order.service.spec.ts` (STORE_PICKUP multi-step, idempotency, fulfillment guards)                                                                                                                   |
| **Current implementation status** | **Implemented**                                                                                                                                                                                      |
| **Known gaps**                    | Historical pre-fix DELIVERED/stale packages may need reconcile CLI                                                                                                                                   |

---

## UC-ORD-06 — Return sync

| Field                             | Content                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-06                                                                  |
| **Name**                          | Đồng bộ đổi trả → đơn / Return sync                                        |
| **Actor**                         | A03 Staff+                                                                 |
| **Supporting actors/services**    | warranty-service                                                           |
| **Preconditions**                 | Return workflow advanced                                                   |
| **Trigger**                       | Warranty return transitions/cancel                                         |
| **Input**                         | Return sync body + optional idempotency                                    |
| **Main flow**                     | `POST /orders/:orderId/return-sync` → `RETURN_REQUESTED` / `RETURNED` etc. |
| **Alternate flows**               | —                                                                          |
| **Error flows**                   | Forbidden; illegal transition                                              |
| **Authorization**                 | Staff+                                                                     |
| **Database changes**              | Order status                                                               |
| **Events produced**               | `order.order.return.*`                                                     |
| **Events consumed**               | None                                                                       |
| **API endpoints**                 | `POST /api/v1/orders/:orderId/return-sync`                                 |
| **Response contract**             | Order DTO                                                                  |
| **Idempotency rule**              | Supported                                                                  |
| **Postconditions**                | Order reflects return state                                                |
| **Automated test mapping**        | order service specs; warranty service sync paths                           |
| **Current implementation status** | **Implemented**                                                            |
| **Known gaps**                    | —                                                                          |

---

## UC-ORD-07 — Admin order ops & fulfillment guards

| Field                             | Content                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ORD-07                                                                                                                                                                                                                                         |
| **Name**                          | Vận hành đơn admin / Admin order operations                                                                                                                                                                                                       |
| **Actor**                         | A03 Staff+; reconcile **Admin+**                                                                                                                                                                                                                  |
| **Supporting actors/services**    | order-service; admin drawer `/don-hang`                                                                                                                                                                                                           |
| **Preconditions**                 | Staff session                                                                                                                                                                                                                                     |
| **Trigger**                       | Admin list/detail/transition                                                                                                                                                                                                                      |
| **Input**                         | Status transition targets; cancel/confirm; reconcile                                                                                                                                                                                              |
| **Main flow**                     | List/get; `status-transitions` with fulfillment guards (manual SHIPPED/DELIVERED reject if packages not ready; STORE_PICKUP DELIVERED always rejected via status-transitions — must shipping-sync); `reconcile-fulfillment` Admin-only idempotent |
| **Alternate flows**               | Reconcile no-op unless order DELIVERED                                                                                                                                                                                                            |
| **Error flows**                   | Guard rejection; forbidden                                                                                                                                                                                                                        |
| **Authorization**                 | Staff+; reconcile `requireAdmin`                                                                                                                                                                                                                  |
| **Database changes**              | Order/package alignment                                                                                                                                                                                                                           |
| **Events produced**               | Status change events when transition succeeds                                                                                                                                                                                                     |
| **Events consumed**               | None                                                                                                                                                                                                                                              |
| **API endpoints**                 | `GET/POST /api/v1/admin/orders...` including `.../reconcile-fulfillment`                                                                                                                                                                          |
| **Response contract**             | Admin order DTOs                                                                                                                                                                                                                                  |
| **Idempotency rule**              | Transitions/reconcile idempotent where keyed                                                                                                                                                                                                      |
| **Postconditions**                | Ops state applied under guards                                                                                                                                                                                                                    |
| **Automated test mapping**        | `order.service.spec.ts` fulfillment-guard + reconcile tests (51 unit tests green historically)                                                                                                                                                    |
| **Current implementation status** | **Implemented**                                                                                                                                                                                                                                   |
| **Known gaps**                    | Manual RC rebuild/reconcile may still be needed for old rows                                                                                                                                                                                      |

---

## Domain summary

| Fact                 | Detail                                                  |
| -------------------- | ------------------------------------------------------- |
| Sync transport       | REST payment-sync / shipping-sync / return-sync         |
| Not present          | RabbitMQ consumer on order-service for shipment/payment |
| Invoice PDF          | **Gap** — not found                                     |
| Runtime Orders empty | Documented operational RC issue                         |
