# 13 — Notification Use Cases

Service: `notification-service`
Prefixes: `/api/v1/notifications/*`, `/api/v1/admin/notifications/*`
Role: consumer (RabbitMQ inbox) + REST for in-app notifications. **No outbox producer.**

Queue: `notification-service.events` · Exchange: `nexatech.events`

---

## UC-NOT-01 — Consume domain events → notify user

| Field                             | Content                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-NOT-01                                                                                                                                 |
| **Name**                          | Sinh thông báo từ sự kiện / Event-driven notifications                                                                                    |
| **Actor**                         | A09 RabbitMQ Consumer                                                                                                                     |
| **Supporting actors/services**    | producers with outbox (order/payment/shipping/review/warranty/support); identity events **expected but not published**                    |
| **Preconditions**                 | RabbitMQ up; event type in `CONSUMED_EVENT_TYPES`                                                                                         |
| **Trigger**                       | Message on queue                                                                                                                          |
| **Input**                         | Event envelope (`eventId`, type, payload)                                                                                                 |
| **Main flow**                     | Inbox dedupe by `eventId` → template → in-app Notification (+ email attempt)                                                              |
| **Alternate flows**               | Skip unknown types                                                                                                                        |
| **Error flows**                   | Handler failure → retry/DLX per consumer config                                                                                           |
| **Authorization**                 | N/A (broker trust)                                                                                                                        |
| **Database changes**              | Notification; EmailDelivery; ProcessedEvent                                                                                               |
| **Events produced**               | None                                                                                                                                      |
| **Events consumed**               | Subset: identity `user.registered                                                                                                         | email_verified | password_reset_requested`(producers missing); order created/confirmed/shipped/delivered/cancelled; payment paid/failed/refunded; shipment out-for-delivery/delivered/delivery-failed; review published/reply.created/rejected; warranty claim/return approved/rejected/completed; support created/assigned/resolved/closed/message_added;`notification.requested` |
| **API endpoints**                 | None (consumer)                                                                                                                           |
| **Response contract**             | N/A                                                                                                                                       |
| **Idempotency rule**              | Inbox `ProcessedEvent` by `eventId`                                                                                                       |
| **Postconditions**                | User has in-app notification and/or email row                                                                                             |
| **Automated test mapping**        | `event-handlers.spec.ts`, `notification.service.spec.ts`, `email.sender.spec.ts`, `templates.spec.ts`                                     |
| **Current implementation status** | **Partial**                                                                                                                               |
| **Known gaps**                    | Identity/customer events never published; docs/EVENTS.md lists broader set than code; PROGRESS DEF-019 proof after real orders still open |

---

## UC-NOT-02 — List / read / delete my notifications

| Field                             | Content                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-NOT-02                                                                                     |
| **Name**                          | Hộp thông báo trong website / In-app inbox                                                    |
| **Actor**                         | A02 Customer (and staff users with userId)                                                    |
| **Supporting actors/services**    | notification-service; storefront BFF                                                          |
| **Preconditions**                 | `x-user-id`                                                                                   |
| **Trigger**                       | Bell icon / notifications page                                                                |
| **Input**                         | Pagination query; notification id                                                             |
| **Main flow**                     | `GET /notifications`, `GET /unread-count`, `PATCH /:id/read`, `POST /read-all`, `DELETE /:id` |
| **Alternate flows**               | —                                                                                             |
| **Error flows**                   | Not owner                                                                                     |
| **Authorization**                 | Owner by userId header                                                                        |
| **Database changes**              | Read flags / deletes                                                                          |
| **Events produced**               | None                                                                                          |
| **Events consumed**               | None                                                                                          |
| **API endpoints**                 | `/api/v1/notifications...`                                                                    |
| **Response contract**             | Notification DTOs + count                                                                     |
| **Idempotency rule**              | Read-all idempotent                                                                           |
| **Postconditions**                | Unread count decreases                                                                        |
| **Automated test mapping**        | `notification.controller.spec.ts`, service specs                                              |
| **Current implementation status** | **Implemented**                                                                               |
| **Known gaps**                    | Depends on UC-NOT-01 producers                                                                |

---

## UC-NOT-03 — Staff request notification

| Field                             | Content                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| **Use case ID**                   | UC-NOT-03                                                      |
| **Name**                          | Nhân viên yêu cầu gửi thông báo / Staff notification request   |
| **Actor**                         | A03 Staff+                                                     |
| **Supporting actors/services**    | notification-service                                           |
| **Preconditions**                 | Staff headers                                                  |
| **Trigger**                       | Ops/manual notify                                              |
| **Input**                         | `notification.requested` payload via REST                      |
| **Main flow**                     | `POST /notifications/request` → create notifications           |
| **Alternate flows**               | —                                                              |
| **Error flows**                   | Forbidden                                                      |
| **Authorization**                 | `requireStaff`                                                 |
| **Database changes**              | Notification rows                                              |
| **Events produced**               | None (direct)                                                  |
| **Events consumed**               | May also consume `notification.requested` from bus             |
| **API endpoints**                 | `POST /api/v1/notifications/request`                           |
| **Response contract**             | Request result DTO                                             |
| **Idempotency rule**              | Per service implementation                                     |
| **Postconditions**                | Targets notified                                               |
| **Automated test mapping**        | notification controller/service specs                          |
| **Current implementation status** | **Implemented**                                                |
| **Known gaps**                    | Admin UI menu for `/thong-bao` is Manager+ while API is Staff+ |

---

## UC-NOT-04 — Admin email delivery audit

| Field                             | Content                                                   |
| --------------------------------- | --------------------------------------------------------- |
| **Use case ID**                   | UC-NOT-04                                                 |
| **Name**                          | Nhật ký gửi email / Email deliveries admin                |
| **Actor**                         | A03 Staff+                                                |
| **Supporting actors/services**    | notification-service; admin notifications page            |
| **Preconditions**                 | Staff session                                             |
| **Trigger**                       | Ops email audit                                           |
| **Input**                         | Query filters                                             |
| **Main flow**                     | `GET /admin/notifications/email-deliveries`               |
| **Alternate flows**               | —                                                         |
| **Error flows**                   | Forbidden                                                 |
| **Authorization**                 | `requireStaff`                                            |
| **Database changes**              | None                                                      |
| **Events produced**               | None                                                      |
| **Events consumed**               | None                                                      |
| **API endpoints**                 | `GET /api/v1/admin/notifications/email-deliveries`        |
| **Response contract**             | EmailDelivery list                                        |
| **Idempotency rule**              | N/A                                                       |
| **Postconditions**                | —                                                         |
| **Automated test mapping**        | notification specs                                        |
| **Current implementation status** | **Implemented**                                           |
| **Known gaps**                    | Real SMTP needs Gmail/App Password credentials from owner |

---

## Domain summary

| Status                 | Notes                                    |
| ---------------------- | ---------------------------------------- |
| REST inbox             | Implemented                              |
| Event consumer         | Partial — depends on upstream publishers |
| Identity-driven emails | Gap (no publish)                         |
| End-to-end RC proof    | Gap / open in PROGRESS                   |
