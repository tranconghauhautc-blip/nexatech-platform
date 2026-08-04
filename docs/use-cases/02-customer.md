# 02 — Customer Use Cases

Service: `customer-service` · Prefix: `/api/v1/customers/*`
Auth: all routes require `x-user-id` (and `x-user-name` on `GET me`). No role hierarchy checks.

---

## UC-CUS-01 — Get or create my profile

| Field                             | Content                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| **Use case ID**                   | UC-CUS-01                                                                  |
| **Name**                          | Lấy / tạo hồ sơ khách / Get-or-create profile                              |
| **Actor**                         | A02 Customer                                                               |
| **Supporting actors/services**    | customer-service; storefront account pages via BFF `/api/bff/customer/...` |
| **Preconditions**                 | BFF session injects `x-user-id`                                            |
| **Trigger**                       | Open account / first authenticated customer call                           |
| **Input**                         | Headers `x-user-id`, `x-user-name` (GET me)                                |
| **Main flow**                     | Lazy `getOrCreateMe` → return `CustomerProfile`                            |
| **Alternate flows**               | Profile already exists → return as-is                                      |
| **Error flows**                   | Missing `x-user-id` → unauthorized/error envelope                          |
| **Authorization**                 | Authenticated customer header; no Staff bypass needed                      |
| **Database changes**              | Insert `CustomerProfile` on first access; optional `CustomerPreference`    |
| **Events produced**               | **None** (`customer.profile_created` contract unused)                      |
| **Events consumed**               | None                                                                       |
| **API endpoints**                 | `GET /api/v1/customers/me`                                                 |
| **Response contract**             | Customer profile DTO                                                       |
| **Idempotency rule**              | Natural idempotent get-or-create by userId                                 |
| **Postconditions**                | Profile exists for userId                                                  |
| **Automated test mapping**        | `apps/customer-service/src/app/customer/customer.service.spec.ts`          |
| **Current implementation status** | **Implemented**                                                            |
| **Known gaps**                    | No event from identity register → customer; no RabbitMQ publish            |

---

## UC-CUS-02 — Update my profile

| Field                             | Content                                                |
| --------------------------------- | ------------------------------------------------------ |
| **Use case ID**                   | UC-CUS-02                                              |
| **Name**                          | Cập nhật hồ sơ / Update profile                        |
| **Actor**                         | A02 Customer                                           |
| **Supporting actors/services**    | customer-service                                       |
| **Preconditions**                 | Profile exists or will be created                      |
| **Trigger**                       | Save profile form                                      |
| **Input**                         | Profile update body (Zod contract)                     |
| **Main flow**                     | `PUT /customers/me` validates → updates profile fields |
| **Alternate flows**               | —                                                      |
| **Error flows**                   | Validation failure                                     |
| **Authorization**                 | `x-user-id` scoped                                     |
| **Database changes**              | `CustomerProfile` update                               |
| **Events produced**               | None                                                   |
| **Events consumed**               | None                                                   |
| **API endpoints**                 | `PUT /api/v1/customers/me`                             |
| **Response contract**             | Updated profile DTO                                    |
| **Idempotency rule**              | None                                                   |
| **Postconditions**                | Profile reflects new values                            |
| **Automated test mapping**        | `customer.service.spec.ts`                             |
| **Current implementation status** | **Implemented**                                        |
| **Known gaps**                    | —                                                      |

---

## UC-CUS-03 — List addresses

| Field                             | Content                                |
| --------------------------------- | -------------------------------------- |
| **Use case ID**                   | UC-CUS-03                              |
| **Name**                          | Danh sách địa chỉ / List addresses     |
| **Actor**                         | A02 Customer                           |
| **Supporting actors/services**    | customer-service                       |
| **Preconditions**                 | Authenticated                          |
| **Trigger**                       | Address book / checkout address picker |
| **Input**                         | `x-user-id`                            |
| **Main flow**                     | Return addresses for customer          |
| **Alternate flows**               | Empty list                             |
| **Error flows**                   | Missing auth header                    |
| **Authorization**                 | Owner only                             |
| **Database changes**              | None                                   |
| **Events produced**               | None                                   |
| **Events consumed**               | None                                   |
| **API endpoints**                 | `GET /api/v1/customers/me/addresses`   |
| **Response contract**             | Address[] DTO                          |
| **Idempotency rule**              | N/A                                    |
| **Postconditions**                | —                                      |
| **Automated test mapping**        | `customer.service.spec.ts`             |
| **Current implementation status** | **Implemented**                        |
| **Known gaps**                    | —                                      |

---

## UC-CUS-04 — Create address

| Field                             | Content                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| **Use case ID**                   | UC-CUS-04                                                       |
| **Name**                          | Thêm địa chỉ / Create address                                   |
| **Actor**                         | A02 Customer                                                    |
| **Supporting actors/services**    | customer-service (VN province/ward codes supported)             |
| **Preconditions**                 | Authenticated                                                   |
| **Trigger**                       | Add address form                                                |
| **Input**                         | Address create body                                             |
| **Main flow**                     | Validate → insert `Address` (default flag handling per service) |
| **Alternate flows**               | Set as default may unset others                                 |
| **Error flows**                   | Validation                                                      |
| **Authorization**                 | Owner                                                           |
| **Database changes**              | `Address` insert                                                |
| **Events produced**               | None                                                            |
| **Events consumed**               | None                                                            |
| **API endpoints**                 | `POST /api/v1/customers/me/addresses`                           |
| **Response contract**             | Address DTO                                                     |
| **Idempotency rule**              | None                                                            |
| **Postconditions**                | Address available for checkout                                  |
| **Automated test mapping**        | `customer.service.spec.ts`                                      |
| **Current implementation status** | **Implemented**                                                 |
| **Known gaps**                    | —                                                               |

---

## UC-CUS-05 — Update address

| Field                             | Content                                  |
| --------------------------------- | ---------------------------------------- |
| **Use case ID**                   | UC-CUS-05                                |
| **Name**                          | Sửa địa chỉ / Update address             |
| **Actor**                         | A02 Customer                             |
| **Supporting actors/services**    | customer-service                         |
| **Preconditions**                 | Address belongs to customer              |
| **Trigger**                       | Edit address                             |
| **Input**                         | Path `:id` + update body                 |
| **Main flow**                     | Ownership check → update                 |
| **Alternate flows**               | —                                        |
| **Error flows**                   | Not found / not owner                    |
| **Authorization**                 | Owner                                    |
| **Database changes**              | `Address` update                         |
| **Events produced**               | None                                     |
| **Events consumed**               | None                                     |
| **API endpoints**                 | `PUT /api/v1/customers/me/addresses/:id` |
| **Response contract**             | Address DTO                              |
| **Idempotency rule**              | None                                     |
| **Postconditions**                | Updated address                          |
| **Automated test mapping**        | `customer.service.spec.ts`               |
| **Current implementation status** | **Implemented**                          |
| **Known gaps**                    | —                                        |

---

## UC-CUS-06 — Delete address

| Field                             | Content                                     |
| --------------------------------- | ------------------------------------------- |
| **Use case ID**                   | UC-CUS-06                                   |
| **Name**                          | Xóa địa chỉ / Delete address                |
| **Actor**                         | A02 Customer                                |
| **Supporting actors/services**    | customer-service                            |
| **Preconditions**                 | Address belongs to customer                 |
| **Trigger**                       | Delete action                               |
| **Input**                         | Path `:id`                                  |
| **Main flow**                     | Ownership check → delete                    |
| **Alternate flows**               | —                                           |
| **Error flows**                   | Not found / not owner                       |
| **Authorization**                 | Owner                                       |
| **Database changes**              | `Address` delete                            |
| **Events produced**               | None                                        |
| **Events consumed**               | None                                        |
| **API endpoints**                 | `DELETE /api/v1/customers/me/addresses/:id` |
| **Response contract**             | Ack                                         |
| **Idempotency rule**              | None                                        |
| **Postconditions**                | Address removed                             |
| **Automated test mapping**        | `customer.service.spec.ts`                  |
| **Current implementation status** | **Implemented**                             |
| **Known gaps**                    | —                                           |

---

## Domain summary

| Status      | Notes                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Implemented | UC-CUS-01…06 REST profile/address CRUD                                |
| Gap         | No `customer.profile_created` RabbitMQ event despite shared contracts |
| Gap         | No identity→customer orchestration on register                        |
