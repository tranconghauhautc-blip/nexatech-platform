# 07 — Payment Use Cases

Service: `payment-service`
Prefixes: `/api/v1/payments/*`, `/mock-payments/*`, `/vnpay/*`, `/admin/payments/*`
Order sync: REST `POST /api/v1/orders/:orderId/payment-sync` (Staff+).

Payment lifecycle: `CREATED`, `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`, `PARTIALLY_REFUNDED`

---

## UC-PAY-01 — Create payment for order

| Field                             | Content                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- | ------- | ----------- |
| **Use case ID**                   | UC-PAY-01                                                                       |
| **Name**                          | Tạo thanh toán / Create payment                                                 |
| **Actor**                         | A02 Customer                                                                    |
| **Supporting actors/services**    | payment-service; order-service                                                  |
| **Preconditions**                 | Order exists for customer; unpaid                                               |
| **Trigger**                       | After checkout / pay CTA                                                        |
| **Input**                         | Create payment body (orderId, method COD/MOCK/VNPAY, amount, `idempotencyKey?`) |
| **Main flow**                     | Create Payment → outbox initiated/created → return checkout info                |
| **Alternate flows**               | COD stays unpaid until collect; MOCK/VNPay return checkout URL/id               |
| **Error flows**                   | Duplicate; amount mismatch; unauthorized                                        |
| **Authorization**                 | Customer owner                                                                  |
| **Database changes**              | Payment (+ outbox/idempotency)                                                  |
| **Events produced**               | `payment.payment.initiated                                                      | created | pending...` |
| **Events consumed**               | None (handlers exist but unwired)                                               |
| **API endpoints**                 | `POST /api/v1/payments`                                                         |
| **Response contract**             | Payment DTO                                                                     |
| **Idempotency rule**              | Create idempotency supported                                                    |
| **Postconditions**                | Payment row linked to order                                                     |
| **Automated test mapping**        | `payment.service.spec.ts`, `payment.controller.spec.ts`                         |
| **Current implementation status** | **Implemented**                                                                 |
| **Known gaps**                    | —                                                                               |

---

## UC-PAY-02 — Mock payment succeed / fail / cancel

| Field                             | Content                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------- | ------- |
| **Use case ID**                   | UC-PAY-02                                                                                                                                               |
| **Name**                          | Thanh toán mock / Mock provider outcomes                                                                                                                |
| **Actor**                         | A02 Customer, A07 Mock Payment Provider                                                                                                                 |
| **Supporting actors/services**    | payment-service → order payment-sync                                                                                                                    |
| **Preconditions**                 | Payment method MOCK, status pending                                                                                                                     |
| **Trigger**                       | Sandbox checkout UI                                                                                                                                     |
| **Input**                         | Path `paymentId`                                                                                                                                        |
| **Main flow**                     | `GET .../checkout` → `POST .../succeed                                                                                                                  | fail    | cancel`→ mark lifecycle →`syncOrderIfNeeded` |
| **Alternate flows**               | Fail/cancel paths                                                                                                                                       |
| **Error flows**                   | Illegal transition                                                                                                                                      |
| **Authorization**                 | Caller headers forwarded to order sync                                                                                                                  |
| **Database changes**              | Payment status; `orderSyncedAt` if sync OK                                                                                                              |
| **Events produced**               | `payment.payment.paid                                                                                                                                   | failed  | cancelled`                                   |
| **Events consumed**               | None                                                                                                                                                    |
| **API endpoints**                 | `GET/POST /api/v1/mock-payments/:paymentId/checkout                                                                                                     | succeed | fail                                         | cancel` |
| **Response contract**             | Payment DTO                                                                                                                                             |
| **Idempotency rule**              | State machine + sync key `sync-${paymentId}-paid`                                                                                                       |
| **Postconditions**                | Intended: order PAID/CONFIRMED                                                                                                                          |
| **Automated test mapping**        | payment service/controller specs                                                                                                                        |
| **Current implementation status** | **Partial**                                                                                                                                             |
| **Known gaps**                    | None for Staff sync identity (fixed: `serviceSyncHeaders`). Still: Rabbit order-delivered auto-collect COD may be unwired; LoggingEmail when SMTP unset |

---

## UC-PAY-03 — VNPay sandbox return / IPN

| Field                             | Content                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **Use case ID**                   | UC-PAY-03                                                                    |
| **Name**                          | VNPay Sandbox callback / VNPay return & IPN                                  |
| **Actor**                         | A07 Mock/Sandbox Provider                                                    |
| **Supporting actors/services**    | payment-service VNPay adapter; order sync with `systemActor` Admin           |
| **Preconditions**                 | VNPay env credentials configured                                             |
| **Trigger**                       | Browser return or IPN                                                        |
| **Input**                         | VNPay query/body signature params                                            |
| **Main flow**                     | Verify signature → mark paid/failed → `payment-sync` with Admin system actor |
| **Alternate flows**               | Return URL UX vs IPN server-to-server                                        |
| **Error flows**                   | Bad signature; duplicate IPN (payloadHash)                                   |
| **Authorization**                 | Provider callback; sync uses Admin roles                                     |
| **Database changes**              | Payment; idempotent callback hash                                            |
| **Events produced**               | payment paid/failed events                                                   |
| **Events consumed**               | None                                                                         |
| **API endpoints**                 | `GET /api/v1/vnpay/return`, `GET                                             | POST /api/v1/vnpay/ipn` |
| **Response contract**             | Redirect/ack per VNPay                                                       |
| **Idempotency rule**              | Callback `payloadHash` + `orderSyncedAt`                                     |
| **Postconditions**                | Order sync likely succeeds (Admin actor)                                     |
| **Automated test mapping**        | `vnpay.provider.spec.ts`, payment specs                                      |
| **Current implementation status** | **Implemented** (adapter; needs real sandbox creds)                          |
| **Known gaps**                    | Requires owner-provided VNPay credentials in env                             |

---

## UC-PAY-04 — COD collect

| Field                             | Content                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-PAY-04                                                                                                        |
| **Name**                          | Thu tiền COD / COD collect                                                                                       |
| **Actor**                         | A03 Staff+ (intended)                                                                                            |
| **Supporting actors/services**    | payment-service; order sync (`confirmOrder: false`)                                                              |
| **Preconditions**                 | Payment method COD; order delivered/ops ready                                                                    |
| **Trigger**                       | Admin collect action                                                                                             |
| **Input**                         | `paymentId`                                                                                                      |
| **Main flow**                     | `POST /admin/payments/:paymentId/cod-collect` → `markCodCollected` → sync PAID                                   |
| **Alternate flows**               | Intended auto-collect on order delivered via `handleOrderDelivered` — **not bound to Rabbit consumer**           |
| **Error flows**                   | Wrong method/status                                                                                              |
| **Authorization**                 | Admin list/get require Staff; **cod-collect method itself does not call `requireStaff`** — relies on BFF headers |
| **Database changes**              | Payment PAID                                                                                                     |
| **Events produced**               | payment paid                                                                                                     |
| **Events consumed**               | None (unwired delivered handler)                                                                                 |
| **API endpoints**                 | `POST /api/v1/admin/payments/:paymentId/cod-collect`                                                             |
| **Response contract**             | Payment DTO                                                                                                      |
| **Idempotency rule**              | State machine                                                                                                    |
| **Postconditions**                | COD marked collected                                                                                             |
| **Automated test mapping**        | payment service specs                                                                                            |
| **Current implementation status** | **Partial**                                                                                                      |
| **Known gaps**                    | Missing explicit `requireStaff` on collect; auto-collect on delivery unwired                                     |

---

## UC-PAY-05 — Customer view / cancel / refund request

| Field                             | Content                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- | ---------- | ------ | ------------------------ |
| **Use case ID**                   | UC-PAY-05                                                                                 |
| **Name**                          | Xem / hủy / hoàn tiền (khách) / Customer payment ops                                      |
| **Actor**                         | A02 Customer                                                                              |
| **Supporting actors/services**    | payment-service                                                                           |
| **Preconditions**                 | Payment owned by user                                                                     |
| **Trigger**                       | Account payment UI                                                                        |
| **Input**                         | paymentId; refund body                                                                    |
| **Main flow**                     | `GET /payments/me`, `by-order/:orderId`, `/:paymentId`; `POST cancel`; `POST/GET refunds` |
| **Alternate flows**               | Admin refund endpoint                                                                     |
| **Error flows**                   | Not owner; illegal state                                                                  |
| **Authorization**                 | Owner; admin refunds Staff+                                                               |
| **Database changes**              | Payment/refund rows                                                                       |
| **Events produced**               | `payment.payment.refund.*`                                                                |
| **Events consumed**               | None                                                                                      |
| **API endpoints**                 | `/api/v1/payments/me                                                                      | by-order/:orderId | :paymentId | cancel | refunds` · admin refunds |
| **Response contract**             | Payment/Refund DTOs                                                                       |
| **Idempotency rule**              | Refund idempotency supported                                                              |
| **Postconditions**                | Cancelled or refund pipeline started                                                      |
| **Automated test mapping**        | payment specs                                                                             |
| **Current implementation status** | **Implemented**                                                                           |
| **Known gaps**                    | Warranty `refund_requested` not consumed by payment                                       |

---

## UC-PAY-06 — Admin list payments

| Field                             | Content                                                 |
| --------------------------------- | ------------------------------------------------------- |
| **Use case ID**                   | UC-PAY-06                                               |
| **Name**                          | Admin liệt kê thanh toán / Admin payments               |
| **Actor**                         | A03 Staff+                                              |
| **Supporting actors/services**    | payment-service; admin `/thanh-toan`                    |
| **Preconditions**                 | Staff session                                           |
| **Trigger**                       | Admin payments page                                     |
| **Input**                         | Query filters                                           |
| **Main flow**                     | `GET /admin/payments`, `GET /admin/payments/:paymentId` |
| **Alternate flows**               | —                                                       |
| **Error flows**                   | Forbidden                                               |
| **Authorization**                 | Staff+                                                  |
| **Database changes**              | None                                                    |
| **Events produced**               | None                                                    |
| **Events consumed**               | None                                                    |
| **API endpoints**                 | `GET /api/v1/admin/payments`, `/:paymentId`             |
| **Response contract**             | Admin payment DTOs                                      |
| **Idempotency rule**              | N/A                                                     |
| **Postconditions**                | —                                                       |
| **Automated test mapping**        | payment controller specs                                |
| **Current implementation status** | **Implemented**                                         |
| **Known gaps**                    | —                                                       |

---

## Domain summary

| Path                                    | Order sync identity                   | Status          |
| --------------------------------------- | ------------------------------------- | --------------- |
| VNPay                                   | Admin systemActor                     | Implemented     |
| Mock succeed as customer                | Staff service identity on sync        | **Implemented** |
| COD collect                             | Caller headers; no local requireStaff | Partial         |
| Rabbit `handleOrderDelivered/Cancelled` | Unwired                               | Gap             |
