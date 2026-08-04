# 11 — Warranty & Return Use Cases

Service: `warranty-service`
Prefixes: `/api/v1/warranty/claims/*`, `/api/v1/returns/*`, `/api/v1/admin/warranty/*`, `/api/v1/admin/returns/*`
Admin gate: local `requireStaff`. Order sync via REST `return-sync` with Staff identity on sensitive paths.

---

## UC-WAR-01 — Create warranty claim

| Field                             | Content                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Use case ID**                   | UC-WAR-01                                                                    |
| **Name**                          | Tạo yêu cầu bảo hành / Create warranty claim                                 |
| **Actor**                         | A02 Customer                                                                 |
| **Supporting actors/services**    | warranty-service; order eligibility (DELIVERED ok even if package skew — RC) |
| **Preconditions**                 | Purchased item; within warranty policy checks in service                     |
| **Trigger**                       | Submit claim form                                                            |
| **Input**                         | orderId, item, symptom, media refs, `idempotencyKey?`                        |
| **Main flow**                     | Validate → create claim → outbox `warranty.claim_*`                          |
| **Alternate flows**               | Attach media later                                                           |
| **Error flows**                   | Not eligible                                                                 |
| **Authorization**                 | Customer owner                                                               |
| **Database changes**              | WarrantyClaim                                                                |
| **Events produced**               | claim created/updated events                                                 |
| **Events consumed**               | None                                                                         |
| **API endpoints**                 | `POST /api/v1/warranty/claims`                                               |
| **Response contract**             | Claim DTO                                                                    |
| **Idempotency rule**              | Optional key                                                                 |
| **Postconditions**                | Claim pending staff review                                                   |
| **Automated test mapping**        | `warranty.service.spec.ts`, `claim-state-machine.spec.ts`                    |
| **Current implementation status** | **Implemented**                                                              |
| **Known gaps**                    | —                                                                            |

---

## UC-WAR-02 — Customer list / get / cancel / attach media (claims)

| Field                             | Content                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-WAR-02                                                                                |
| **Name**                          | Quản lý claim phía khách / Customer claim ops                                            |
| **Actor**                         | A02 Customer                                                                             |
| **Supporting actors/services**    | warranty-service; media-service                                                          |
| **Preconditions**                 | Owns claim                                                                               |
| **Trigger**                       | Account warranty UI                                                                      |
| **Input**                         | claimId; media payload                                                                   |
| **Main flow**                     | `GET /warranty/claims`, `GET /:claimId`, `POST /:claimId/media`, `POST /:claimId/cancel` |
| **Alternate flows**               | —                                                                                        |
| **Error flows**                   | Not owner; illegal cancel                                                                |
| **Authorization**                 | Owner (staff can read via admin)                                                         |
| **Database changes**              | Claim/media/cancel status                                                                |
| **Events produced**               | claim cancelled/updated                                                                  |
| **Events consumed**               | None                                                                                     |
| **API endpoints**                 | `/api/v1/warranty/claims...`                                                             |
| **Response contract**             | Claim DTOs                                                                               |
| **Idempotency rule**              | Cancel state-guarded                                                                     |
| **Postconditions**                | Claim updated                                                                            |
| **Automated test mapping**        | warranty controller/service specs                                                        |
| **Current implementation status** | **Implemented**                                                                          |
| **Known gaps**                    | —                                                                                        |

---

## UC-WAR-03 — Staff transition warranty claims

| Field                             | Content                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-WAR-03                                                                                                    |
| **Name**                          | Nhân viên xử lý bảo hành / Admin claim transition                                                            |
| **Actor**                         | A03 Staff+                                                                                                   |
| **Supporting actors/services**    | warranty-service; admin `/bao-hanh`                                                                          |
| **Preconditions**                 | Staff session                                                                                                |
| **Trigger**                       | Approve/reject/complete                                                                                      |
| **Input**                         | Transition target + notes                                                                                    |
| **Main flow**                     | Admin list/get → `POST /admin/warranty/claims/:claimId/transition`                                           |
| **Alternate flows**               | —                                                                                                            |
| **Error flows**                   | Illegal transition; forbidden                                                                                |
| **Authorization**                 | `requireStaff`                                                                                               |
| **Database changes**              | Claim status                                                                                                 |
| **Events produced**               | approved/rejected/completed (consumed by notification/reporting)                                             |
| **Events consumed**               | None                                                                                                         |
| **API endpoints**                 | `/api/v1/admin/warranty/claims...`                                                                           |
| **Response contract**             | Admin claim DTO                                                                                              |
| **Idempotency rule**              | State machine                                                                                                |
| **Postconditions**                | Claim terminal or next state                                                                                 |
| **Automated test mapping**        | `claim-state-machine.spec.ts`, service specs                                                                 |
| **Current implementation status** | **Implemented**                                                                                              |
| **Known gaps**                    | Contract events `warranty.refund_requested` / `inventory_return_requested` not consumed by payment/inventory |

---

## UC-RET-01 — Create return request

| Field                             | Content                                             |
| --------------------------------- | --------------------------------------------------- |
| **Use case ID**                   | UC-RET-01                                           |
| **Name**                          | Tạo yêu cầu đổi trả / Create return                 |
| **Actor**                         | A02 Customer                                        |
| **Supporting actors/services**    | warranty-service; order return-sync                 |
| **Preconditions**                 | Eligible delivered order item                       |
| **Trigger**                       | Return form                                         |
| **Input**                         | Return body + optional idempotency                  |
| **Main flow**                     | `POST /returns` → may sync order `RETURN_REQUESTED` |
| **Alternate flows**               | Media attach                                        |
| **Error flows**                   | Not eligible                                        |
| **Authorization**                 | Customer                                            |
| **Database changes**              | ReturnRequest; order status via sync                |
| **Events produced**               | `warranty.return_*`                                 |
| **Events consumed**               | None                                                |
| **API endpoints**                 | `POST /api/v1/returns`                              |
| **Response contract**             | Return DTO                                          |
| **Idempotency rule**              | Optional                                            |
| **Postconditions**                | Return pending                                      |
| **Automated test mapping**        | `return-state-machine.spec.ts`, warranty specs      |
| **Current implementation status** | **Implemented**                                     |
| **Known gaps**                    | Returns UI noted MEDIUM maturity in PROGRESS        |

---

## UC-RET-02 — Customer return ops

| Field                             | Content                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-RET-02                                                                                                              |
| **Name**                          | Khách theo dõi / hủy đổi trả / Customer return ops                                                                     |
| **Actor**                         | A02 Customer                                                                                                           |
| **Supporting actors/services**    | warranty-service; order sync on cancel uses Staff identity                                                             |
| **Preconditions**                 | Owns return                                                                                                            |
| **Trigger**                       | Account returns                                                                                                        |
| **Input**                         | returnId                                                                                                               |
| **Main flow**                     | `GET /returns`, `GET /:returnId`, `POST /:returnId/media`, `POST /:returnId/cancel` (inter-service sync Staff headers) |
| **Alternate flows**               | —                                                                                                                      |
| **Error flows**                   | Not owner                                                                                                              |
| **Authorization**                 | Owner                                                                                                                  |
| **Database changes**              | Return + order sync                                                                                                    |
| **Events produced**               | return cancelled/updated                                                                                               |
| **Events consumed**               | None                                                                                                                   |
| **API endpoints**                 | `/api/v1/returns...`                                                                                                   |
| **Response contract**             | Return DTOs                                                                                                            |
| **Idempotency rule**              | Cancel guarded                                                                                                         |
| **Postconditions**                | Return closed or updated                                                                                               |
| **Automated test mapping**        | warranty service specs                                                                                                 |
| **Current implementation status** | **Implemented**                                                                                                        |
| **Known gaps**                    | —                                                                                                                      |

---

## UC-RET-03 — Staff transition returns

| Field                             | Content                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-RET-03                                                                                                                 |
| **Name**                          | Nhân viên xử lý đổi trả / Admin return transition                                                                         |
| **Actor**                         | A03 Staff+                                                                                                                |
| **Supporting actors/services**    | warranty-service; order return-sync; intended payment/inventory (events)                                                  |
| **Preconditions**                 | Staff session                                                                                                             |
| **Trigger**                       | Approve/reject/complete return                                                                                            |
| **Input**                         | Transition payload                                                                                                        |
| **Main flow**                     | `POST /admin/returns/:returnId/transition` → order sync → outbox                                                          |
| **Alternate flows**               | —                                                                                                                         |
| **Error flows**                   | Illegal transition                                                                                                        |
| **Authorization**                 | `requireStaff`                                                                                                            |
| **Database changes**              | Return + order RETURNED paths                                                                                             |
| **Events produced**               | return approved/rejected/completed; contract-only refund/inventory return request types may be emitted but **unconsumed** |
| **Events consumed**               | None                                                                                                                      |
| **API endpoints**                 | `/api/v1/admin/returns...`                                                                                                |
| **Response contract**             | Admin return DTO                                                                                                          |
| **Idempotency rule**              | State machine                                                                                                             |
| **Postconditions**                | Return resolved; order may RETURNED                                                                                       |
| **Automated test mapping**        | return state machine + service specs                                                                                      |
| **Current implementation status** | **Partial** (core transitions yes; refund/inventory automation Gap)                                                       |
| **Known gaps**                    | payment/inventory do not consume warranty refund/inventory-return events                                                  |

---

## Domain summary

| Flow                                  | Status                   |
| ------------------------------------- | ------------------------ |
| Claims CRUD + staff transition        | Implemented              |
| Returns CRUD + staff transition       | Implemented (UI partial) |
| Cross-service refund/stock automation | Gap                      |
