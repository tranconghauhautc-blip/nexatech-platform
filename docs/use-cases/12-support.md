# 12 — Support Use Cases

Service: `support-service`
Prefixes: `/api/v1/support/tickets/*`, `/api/v1/admin/support/*`
Admin gate: local `requireStaff`. Outbox → `support.*` events.

---

## UC-SUP-01 — Create support ticket

| Field                             | Content                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-SUP-01                                                                               |
| **Name**                          | Tạo ticket hỗ trợ / Create ticket                                                       |
| **Actor**                         | A02 Customer                                                                            |
| **Supporting actors/services**    | support-service; optional order reference; media attachments                            |
| **Preconditions**                 | Authenticated customer                                                                  |
| **Trigger**                       | Support form                                                                            |
| **Input**                         | subject, body, orderId?, priority?, `idempotencyKey?`                                   |
| **Main flow**                     | `POST /support/tickets` → create → outbox `support.ticket_created`                      |
| **Alternate flows**               | Link order with thumb preview on storefront                                             |
| **Error flows**                   | Validation                                                                              |
| **Authorization**                 | Customer                                                                                |
| **Database changes**              | Ticket + first message                                                                  |
| **Events produced**               | `support.ticket_created`                                                                |
| **Events consumed**               | None                                                                                    |
| **API endpoints**                 | `POST /api/v1/support/tickets`                                                          |
| **Response contract**             | Ticket DTO                                                                              |
| **Idempotency rule**              | Optional key                                                                            |
| **Postconditions**                | Ticket open for staff                                                                   |
| **Automated test mapping**        | `support.service.spec.ts`, `support.controller.spec.ts`, `ticket-state-machine.spec.ts` |
| **Current implementation status** | **Implemented**                                                                         |
| **Known gaps**                    | —                                                                                       |

---

## UC-SUP-02 — Customer ticket thread

| Field                             | Content                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-SUP-02                                                                                                                     |
| **Name**                          | Theo dõi & trả lời ticket / Customer ticket thread                                                                            |
| **Actor**                         | A02 Customer                                                                                                                  |
| **Supporting actors/services**    | support-service                                                                                                               |
| **Preconditions**                 | Owns ticket                                                                                                                   |
| **Trigger**                       | Inbox / ticket detail                                                                                                         |
| **Input**                         | message body; attachment media ids                                                                                            |
| **Main flow**                     | `GET /support/tickets`, `GET /:ticketId`, `POST /:ticketId/messages`, `POST /:ticketId/attachments`, `POST /:ticketId/cancel` |
| **Alternate flows**               | Cancel open ticket                                                                                                            |
| **Error flows**                   | Not owner; closed ticket                                                                                                      |
| **Authorization**                 | Owner                                                                                                                         |
| **Database changes**              | Messages/attachments/status                                                                                                   |
| **Events produced**               | `message_added`, `cancelled`, …                                                                                               |
| **Events consumed**               | None                                                                                                                          |
| **API endpoints**                 | `/api/v1/support/tickets...`                                                                                                  |
| **Response contract**             | Ticket detail DTO                                                                                                             |
| **Idempotency rule**              | Cancel/message guarded                                                                                                        |
| **Postconditions**                | Thread updated                                                                                                                |
| **Automated test mapping**        | support specs                                                                                                                 |
| **Current implementation status** | **Implemented**                                                                                                               |
| **Known gaps**                    | —                                                                                                                             |

---

## UC-SUP-03 — Staff triage (assign, priority, transition, reply)

| Field                             | Content                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | -------- | ------ | ------- | -------------- |
| **Use case ID**                   | UC-SUP-03                                                                                          |
| **Name**                          | Nhân viên xử lý ticket / Staff triage                                                              |
| **Actor**                         | A03 Staff+                                                                                         |
| **Supporting actors/services**    | support-service; admin `/ho-tro`                                                                   |
| **Preconditions**                 | Staff session                                                                                      |
| **Trigger**                       | Admin support console                                                                              |
| **Input**                         | assign userId; priority; transition; staff message                                                 |
| **Main flow**                     | List/get → assign → priority → transition → staff messages                                         |
| **Alternate flows**               | Resolve/close                                                                                      |
| **Error flows**                   | Forbidden; illegal transition                                                                      |
| **Authorization**                 | `requireStaff` on all admin methods                                                                |
| **Database changes**              | Ticket assignment/priority/status/messages                                                         |
| **Events produced**               | `assigned                                                                                          | resolved | closed | updated | message_added` |
| **Events consumed**               | None                                                                                               |
| **API endpoints**                 | `GET/POST/PATCH /api/v1/admin/support/tickets...` (`transition`, `messages`, `assign`, `priority`) |
| **Response contract**             | Admin ticket DTOs                                                                                  |
| **Idempotency rule**              | State machine                                                                                      |
| **Postconditions**                | Ticket progresses to resolution                                                                    |
| **Automated test mapping**        | support service/controller/state-machine specs                                                     |
| **Current implementation status** | **Implemented**                                                                                    |
| **Known gaps**                    | —                                                                                                  |

---

## Domain summary

| Status      | Notes                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Implemented | Customer tickets + staff triage + outbox                                                                   |
| Consumers   | notification/reporting listen for created/assigned/resolved/closed/message_added (per their CONSUMED sets) |
