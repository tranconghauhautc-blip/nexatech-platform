# 10 — Review Use Cases

Service: `review-service`
Prefixes: `/api/v1/reviews/*`, `/api/v1/products/:productId/reviews`, `/api/v1/admin/*`
Admin gate: local `requireStaff` (Staff/Manager/Admin/SuperAdmin). Outbox → RabbitMQ `review.*`.

---

## UC-REV-01 — Create review (verified purchase)

| Field                             | Content                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-REV-01                                                                                    |
| **Name**                          | Viết đánh giá / Create review                                                                |
| **Actor**                         | A02 Customer                                                                                 |
| **Supporting actors/services**    | review-service; order-service eligibility (DELIVERED; package mismatch tolerated per RC fix) |
| **Preconditions**                 | Customer purchased SKU; order DELIVERED (eligibility rules)                                  |
| **Trigger**                       | Submit review form                                                                           |
| **Input**                         | productId, orderId/item, rating, content, `idempotencyKey?`                                  |
| **Main flow**                     | Validate eligibility → create review → outbox `review.created`                               |
| **Alternate flows**               | Draft vs published per moderation policy                                                     |
| **Error flows**                   | Not eligible; duplicate                                                                      |
| **Authorization**                 | Customer owner                                                                               |
| **Database changes**              | Review row                                                                                   |
| **Events produced**               | `review.created` (+ later published)                                                         |
| **Events consumed**               | None                                                                                         |
| **API endpoints**                 | `POST /api/v1/reviews`                                                                       |
| **Response contract**             | Review DTO                                                                                   |
| **Idempotency rule**              | Optional key                                                                                 |
| **Postconditions**                | Review exists for moderation/public                                                          |
| **Automated test mapping**        | `review.service.spec.ts`, `review.controller.spec.ts`, eligibility tests                     |
| **Current implementation status** | **Implemented**                                                                              |
| **Known gaps**                    | —                                                                                            |

---

## UC-REV-02 — Edit / delete my review

| Field                             | Content                                     |
| --------------------------------- | ------------------------------------------- | -------- |
| **Use case ID**                   | UC-REV-02                                   |
| **Name**                          | Sửa / xóa đánh giá / Patch & delete review  |
| **Actor**                         | A02 Customer                                |
| **Supporting actors/services**    | review-service                              |
| **Preconditions**                 | Owns review; editable state                 |
| **Trigger**                       | Edit/delete UI                              |
| **Input**                         | Patch body / delete                         |
| **Main flow**                     | `PATCH /reviews/:id`, `DELETE /reviews/:id` |
| **Alternate flows**               | —                                           |
| **Error flows**                   | Not owner; locked after moderation          |
| **Authorization**                 | Owner                                       |
| **Database changes**              | Review update/delete                        |
| **Events produced**               | `review.updated                             | deleted` |
| **Events consumed**               | None                                        |
| **API endpoints**                 | `PATCH/DELETE /api/v1/reviews/:reviewId`    |
| **Response contract**             | Review DTO / ack                            |
| **Idempotency rule**              | None required                               |
| **Postconditions**                | Review changed                              |
| **Automated test mapping**        | review service specs                        |
| **Current implementation status** | **Implemented**                             |
| **Known gaps**                    | —                                           |

---

## UC-REV-03 — Helpful votes, reports, media, replies

| Field                             | Content                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------- | ----- | ----------- |
| **Use case ID**                   | UC-REV-03                                                                               |
| **Name**                          | Tương tác đánh giá / Helpful, report, media, replies                                    |
| **Actor**                         | A02 Customer; Staff for staff replies                                                   |
| **Supporting actors/services**    | review-service; media-service ids                                                       |
| **Preconditions**                 | Review exists                                                                           |
| **Trigger**                       | Social/moderation actions                                                               |
| **Input**                         | helpful; report body; media ids; reply body                                             |
| **Main flow**                     | `POST/DELETE helpful`; `POST reports`; `POST/DELETE media`; `POST/PATCH/DELETE replies` |
| **Alternate flows**               | Staff reply path                                                                        |
| **Error flows**                   | Unauthorized media attach                                                               |
| **Authorization**                 | Customer for most; staff replies require Staff                                          |
| **Database changes**              | Helpful/Report/Media/Reply tables                                                       |
| **Events produced**               | helpful/report/reply events; aggregates                                                 |
| **Events consumed**               | None                                                                                    |
| **API endpoints**                 | `/api/v1/reviews/:reviewId/helpful                                                      | reports | media | replies...` |
| **Response contract**             | Nested DTOs                                                                             |
| **Idempotency rule**              | Partial (toggle semantics)                                                              |
| **Postconditions**                | Engagement updated                                                                      |
| **Automated test mapping**        | `privacy.spec.ts`, `aggregate.spec.ts`, service specs                                   |
| **Current implementation status** | **Implemented**                                                                         |
| **Known gaps**                    | —                                                                                       |

---

## UC-REV-04 — Public product reviews & summary

| Field                             | Content                                               |
| --------------------------------- | ----------------------------------------------------- |
| **Use case ID**                   | UC-REV-04                                             |
| **Name**                          | Xem đánh giá công khai / Public reviews & summary     |
| **Actor**                         | A01 Guest, A02 Customer                               |
| **Supporting actors/services**    | review-service                                        |
| **Preconditions**                 | Published reviews                                     |
| **Trigger**                       | PDP reviews tab                                       |
| **Input**                         | `productId`                                           |
| **Main flow**                     | `GET /products/:productId/reviews`, `GET .../summary` |
| **Alternate flows**               | Empty                                                 |
| **Error flows**                   | Invalid product                                       |
| **Authorization**                 | Public                                                |
| **Database changes**              | None                                                  |
| **Events produced**               | None                                                  |
| **Events consumed**               | None                                                  |
| **API endpoints**                 | `GET /api/v1/products/:productId/reviews`, `/summary` |
| **Response contract**             | Review list + aggregate                               |
| **Idempotency rule**              | N/A                                                   |
| **Postconditions**                | —                                                     |
| **Automated test mapping**        | review controller specs                               |
| **Current implementation status** | **Implemented**                                       |
| **Known gaps**                    | —                                                     |

---

## UC-REV-05 — Admin moderate & rebuild aggregates

| Field                             | Content                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | -------------------------------------------- |
| **Use case ID**                   | UC-REV-05                                                                                       |
| **Name**                          | Kiểm duyệt đánh giá / Admin moderate                                                            |
| **Actor**                         | A03 Staff+                                                                                      |
| **Supporting actors/services**    | review-service; admin `/danh-gia`                                                               |
| **Preconditions**                 | Staff session                                                                                   |
| **Trigger**                       | Moderation queue                                                                                |
| **Input**                         | Moderate action; report resolve; rebuild                                                        |
| **Main flow**                     | List/get → `POST /admin/reviews/:id/moderate` → resolve reports → optional `aggregates/rebuild` |
| **Alternate flows**               | Hide/reject/publish                                                                             |
| **Error flows**                   | Forbidden                                                                                       |
| **Authorization**                 | `requireStaff`                                                                                  |
| **Database changes**              | Review status; aggregates                                                                       |
| **Events produced**               | `review.published                                                                               | hidden | rejected`, `review.rating-aggregate.updated` |
| **Events consumed**               | None                                                                                            |
| **API endpoints**                 | `/api/v1/admin/reviews...`, `/admin/review-reports...`, `/admin/reviews/aggregates/rebuild`     |
| **Response contract**             | Admin review DTOs                                                                               |
| **Idempotency rule**              | Moderate actions state-guarded                                                                  |
| **Postconditions**                | Public visibility updated                                                                       |
| **Automated test mapping**        | `review-state-machine.spec.ts`, service specs                                                   |
| **Current implementation status** | **Implemented**                                                                                 |
| **Known gaps**                    | Notification consumes published/reply/rejected subset only                                      |

---

## UC-REV-06 — List my reviews

| Field                             | Content                                                   |
| --------------------------------- | --------------------------------------------------------- |
| **Use case ID**                   | UC-REV-06                                                 |
| **Name**                          | Đánh giá của tôi / My reviews                             |
| **Actor**                         | A02 Customer                                              |
| **Supporting actors/services**    | review-service                                            |
| **Preconditions**                 | Authenticated                                             |
| **Trigger**                       | Account reviews                                           |
| **Input**                         | `x-user-id`                                               |
| **Main flow**                     | `GET /reviews/me`                                         |
| **Alternate flows**               | —                                                         |
| **Error flows**                   | Unauthenticated                                           |
| **Authorization**                 | Customer                                                  |
| **Database changes**              | None                                                      |
| **Events produced**               | None                                                      |
| **Events consumed**               | None                                                      |
| **API endpoints**                 | `GET /api/v1/reviews/me`, `GET /api/v1/reviews/:reviewId` |
| **Response contract**             | Review DTOs                                               |
| **Idempotency rule**              | N/A                                                       |
| **Postconditions**                | —                                                         |
| **Automated test mapping**        | review specs                                              |
| **Current implementation status** | **Implemented**                                           |
| **Known gaps**                    | —                                                         |

---

## Domain summary

| Status      | Notes                                                            |
| ----------- | ---------------------------------------------------------------- |
| Implemented | Customer CRUD engagement + public list + Staff moderate + outbox |
| Partial     | Broader event fan-out vs notification consumer subset            |
