# 14 — Reporting Use Cases

Service: `reporting-service`
Prefix: `/api/v1/admin/reporting/*`
Role: RabbitMQ inbox consumer + Staff+ read APIs. **No domain outbox producer** (can record audit via POST).

Queue: `reporting-service.events`

---

## UC-RPT-01 — Consume events into reporting store

| Field                             | Content                                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-RPT-01                                                                                                                                                      |
| **Name**                          | Tổng hợp sự kiện báo cáo / Event projection                                                                                                                    |
| **Actor**                         | A09 RabbitMQ Consumer                                                                                                                                          |
| **Supporting actors/services**    | order/payment/shipping/review/warranty/support outboxes; audit.recorded                                                                                        |
| **Preconditions**                 | Broker + reporting DB                                                                                                                                          |
| **Trigger**                       | Domain event message                                                                                                                                           |
| **Input**                         | Event envelope                                                                                                                                                 |
| **Main flow**                     | Inbox dedupe → project metrics/facts tables                                                                                                                    |
| **Alternate flows**               | Ignore unlisted types                                                                                                                                          |
| **Error flows**                   | Handler failure / retry                                                                                                                                        |
| **Authorization**                 | N/A                                                                                                                                                            |
| **Database changes**              | Reporting projections; ProcessedEvent                                                                                                                          |
| **Events produced**               | None (except via audit POST path)                                                                                                                              |
| **Events consumed**               | Runtime `CONSUMED_EVENT_TYPES`: order/payment/shipment/review/warranty/support + `audit.recorded` — **not** catalog/customer/cart/inventory despite older docs |
| **API endpoints**                 | None                                                                                                                                                           |
| **Response contract**             | N/A                                                                                                                                                            |
| **Idempotency rule**              | Inbox by `eventId`                                                                                                                                             |
| **Postconditions**                | Dashboards reflect events                                                                                                                                      |
| **Automated test mapping**        | `event-handlers.spec.ts`, `event-consumer.spec.ts`, repository integration                                                                                     |
| **Current implementation status** | **Partial**                                                                                                                                                    |
| **Known gaps**                    | Docs wider than code; empty Orders → empty order projections in RC                                                                                             |

---

## UC-RPT-02 — Admin dashboard & daily metrics

| Field                             | Content                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-RPT-02                                                                         |
| **Name**                          | Bảng điều khiển / Dashboard & daily metrics                                       |
| **Actor**                         | A03 Staff+ (API); UI menu Manager+ for `/bao-cao`                                 |
| **Supporting actors/services**    | reporting-service; admin-web BFF                                                  |
| **Preconditions**                 | Staff headers; projected data                                                     |
| **Trigger**                       | Open reports / dashboard widgets                                                  |
| **Input**                         | Date range queries for metrics                                                    |
| **Main flow**                     | `GET /admin/reporting/dashboard`, `GET /admin/reporting/metrics/daily`            |
| **Alternate flows**               | Empty metrics when no events                                                      |
| **Error flows**                   | Forbidden                                                                         |
| **Authorization**                 | `requireStaff`                                                                    |
| **Database changes**              | None                                                                              |
| **Events produced**               | None                                                                              |
| **Events consumed**               | None (read path)                                                                  |
| **API endpoints**                 | `GET /api/v1/admin/reporting/dashboard`, `/metrics/daily`                         |
| **Response contract**             | Dashboard / metrics DTOs                                                          |
| **Idempotency rule**              | N/A                                                                               |
| **Postconditions**                | —                                                                                 |
| **Automated test mapping**        | `reporting.service.spec.ts`, `reporting.controller.spec.ts`                       |
| **Current implementation status** | **Implemented** (API)                                                             |
| **Known gaps**                    | UI Manager vs API Staff; storefront reporting BFF broken (not in SERVICE_ENV_MAP) |

---

## UC-RPT-03 — Domain report lists

| Field                             | Content                                             |
| --------------------------------- | --------------------------------------------------- | -------- | --------- | ------- | --------------- | ---------------- | ---------------- |
| **Use case ID**                   | UC-RPT-03                                           |
| **Name**                          | Báo cáo theo miền / Domain report lists             |
| **Actor**                         | A03 Staff+                                          |
| **Supporting actors/services**    | reporting-service                                   |
| **Preconditions**                 | Projected rows                                      |
| **Trigger**                       | Report tabs                                         |
| **Input**                         | Query filters                                       |
| **Main flow**                     | `GET .../orders                                     | payments | shipments | reviews | warranty/claims | warranty/returns | support/tickets` |
| **Alternate flows**               | Empty lists                                         |
| **Error flows**                   | Forbidden                                           |
| **Authorization**                 | Staff+                                              |
| **Database changes**              | None                                                |
| **Events produced**               | None                                                |
| **Events consumed**               | None                                                |
| **API endpoints**                 | `/api/v1/admin/reporting/orders                     | payments | shipments | reviews | warranty/claims | warranty/returns | support/tickets` |
| **Response contract**             | List DTOs                                           |
| **Idempotency rule**              | N/A                                                 |
| **Postconditions**                | —                                                   |
| **Automated test mapping**        | reporting controller/service specs                  |
| **Current implementation status** | **Implemented**                                     |
| **Known gaps**                    | Data quality depends on producers + RC order volume |

---

## UC-RPT-04 — Audit logs & record audit

| Field                             | Content                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-RPT-04                                                                                           |
| **Name**                          | Nhật ký kiểm toán / Audit logs                                                                      |
| **Actor**                         | A03 Staff+ (API); UI `/nhat-ky` Admin+                                                              |
| **Supporting actors/services**    | reporting-service                                                                                   |
| **Preconditions**                 | Staff/Admin session                                                                                 |
| **Trigger**                       | Audit page / service POST                                                                           |
| **Input**                         | Audit write body; list query                                                                        |
| **Main flow**                     | `GET /admin/reporting/audit-logs`; `POST /admin/reporting/audit` → may emit/record `audit.recorded` |
| **Alternate flows**               | —                                                                                                   |
| **Error flows**                   | Forbidden                                                                                           |
| **Authorization**                 | API Staff+; UI Admin+                                                                               |
| **Database changes**              | Audit log rows                                                                                      |
| **Events produced**               | `audit.recorded` path                                                                               |
| **Events consumed**               | `audit.recorded` (self/inbox)                                                                       |
| **API endpoints**                 | `GET /api/v1/admin/reporting/audit-logs`, `POST /api/v1/admin/reporting/audit`                      |
| **Response contract**             | Audit DTOs                                                                                          |
| **Idempotency rule**              | None required                                                                                       |
| **Postconditions**                | Audit trail appended                                                                                |
| **Automated test mapping**        | reporting specs                                                                                     |
| **Current implementation status** | **Implemented**                                                                                     |
| **Known gaps**                    | UI stricter than API                                                                                |

---

## Domain summary

| Status                   | Notes                |
| ------------------------ | -------------------- |
| Read APIs                | Implemented Staff+   |
| Consumer coverage        | Partial vs docs      |
| Storefront BFF reporting | Gap                  |
| RC empty orders          | Operational data gap |
