# 04 — Inventory Use Cases

Service: `inventory-service`
Prefixes: public `warehouses|stores|stock|...`; mutations `/api/v1/admin/inventory/*`
**Available stock formula:** `available = onHand - reserved` (code in inventory types/repos).

---

## UC-INV-01 — List warehouses & stores (incl. pickup)

| Field                             | Content                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| **Use case ID**                   | UC-INV-01                                                                 |
| **Name**                          | Liệt kê kho & cửa hàng / List warehouses & stores                         |
| **Actor**                         | A01, A02, A03+                                                            |
| **Supporting actors/services**    | inventory-service; checkout pickup store picker                           |
| **Preconditions**                 | Seeded stores/warehouses                                                  |
| **Trigger**                       | Store locator / admin inventory UI / pickup options                       |
| **Input**                         | Optional path `:id`                                                       |
| **Main flow**                     | `GET /warehouses`, `GET /stores`, `GET /stores/pickup`, `GET /stores/:id` |
| **Alternate flows**               | Pickup-only subset for STORE_PICKUP                                       |
| **Error flows**                   | Not found for `:id`                                                       |
| **Authorization**                 | Public GETs                                                               |
| **Database changes**              | None                                                                      |
| **Events produced**               | None                                                                      |
| **Events consumed**               | None                                                                      |
| **API endpoints**                 | `GET /api/v1/warehouses`, `/stores`, `/stores/pickup`, `/stores/:id`      |
| **Response contract**             | Warehouse/Store DTOs                                                      |
| **Idempotency rule**              | N/A                                                                       |
| **Postconditions**                | —                                                                         |
| **Automated test mapping**        | `inventory.controller.spec.ts`, `inventory.service.spec.ts`               |
| **Current implementation status** | **Implemented**                                                           |
| **Known gaps**                    | —                                                                         |

---

## UC-INV-02 — Query stock availability & movements

| Field                             | Content                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-INV-02                                                                                                                                      |
| **Name**                          | Tra cứu tồn kho / Query stock                                                                                                                  |
| **Actor**                         | A01, A02, Staff                                                                                                                                |
| **Supporting actors/services**    | inventory-service; cart validate / PDP availability                                                                                            |
| **Preconditions**                 | Stock rows exist                                                                                                                               |
| **Trigger**                       | Availability check                                                                                                                             |
| **Input**                         | Query sku/warehouse filters                                                                                                                    |
| **Main flow**                     | `GET /stock`, `/stock/availability`, `/stock/sources`, `/stock/low`, `/movements`, `/reservations/:id` — availability uses `onHand - reserved` |
| **Alternate flows**               | Low stock list for ops                                                                                                                         |
| **Error flows**                   | Invalid query                                                                                                                                  |
| **Authorization**                 | Public GETs                                                                                                                                    |
| **Database changes**              | None                                                                                                                                           |
| **Events produced**               | None                                                                                                                                           |
| **Events consumed**               | None                                                                                                                                           |
| **API endpoints**                 | `GET /api/v1/stock*` , `/movements`, `/reservations/:id`                                                                                       |
| **Response contract**             | Stock DTOs with `available`                                                                                                                    |
| **Idempotency rule**              | N/A                                                                                                                                            |
| **Postconditions**                | —                                                                                                                                              |
| **Automated test mapping**        | inventory unit/concurrency/integration specs                                                                                                   |
| **Current implementation status** | **Implemented**                                                                                                                                |
| **Known gaps**                    | —                                                                                                                                              |

---

## UC-INV-03 — Admin create/update warehouses & stores

| Field                             | Content                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------- | ------- |
| **Use case ID**                   | UC-INV-03                                                                        |
| **Name**                          | Quản trị kho & cửa hàng / Admin warehouse & store CRUD                           |
| **Actor**                         | A03 Staff+ (API); UI: `/kho-hang` mutate Staff+, `/cua-hang-kho` mutate Manager+ |
| **Supporting actors/services**    | inventory-service; admin-web                                                     |
| **Preconditions**                 | Staff+ headers                                                                   |
| **Trigger**                       | Admin forms                                                                      |
| **Input**                         | Create/patch bodies                                                              |
| **Main flow**                     | `POST/PATCH admin/inventory/warehouses                                           | stores` |
| **Alternate flows**               | —                                                                                |
| **Error flows**                   | Forbidden; validation                                                            |
| **Authorization**                 | `requireStaff` via `x-user-roles`                                                |
| **Database changes**              | Warehouse/Store tables                                                           |
| **Events produced**               | None for create/update location                                                  |
| **Events consumed**               | None                                                                             |
| **API endpoints**                 | `POST/PATCH /api/v1/admin/inventory/warehouses`, `.../stores`                    |
| **Response contract**             | Warehouse/Store DTOs                                                             |
| **Idempotency rule**              | None                                                                             |
| **Postconditions**                | Locations usable for stock                                                       |
| **Automated test mapping**        | inventory service/controller specs                                               |
| **Current implementation status** | **Implemented**                                                                  |
| **Known gaps**                    | UI Manager gate on store page stricter than API Staff+                           |

---

## UC-INV-04 — Receive / issue / adjust / return stock

| Field                             | Content                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- | ----- | ------ | ------------------------------------------ |
| **Use case ID**                   | UC-INV-04                                                                              |
| **Name**                          | Nhập / xuất / điều chỉnh / hoàn tồn / Stock movements                                  |
| **Actor**                         | A03 Staff+                                                                             |
| **Supporting actors/services**    | inventory-service                                                                      |
| **Preconditions**                 | Warehouse/SKU exist                                                                    |
| **Trigger**                       | Ops stock action                                                                       |
| **Input**                         | Movement payloads with **required** `idempotencyKey`                                   |
| **Main flow**                     | `POST stock/receive                                                                    | issue | adjust | return`updates`onHand` and movement ledger |
| **Alternate flows**               | —                                                                                      |
| **Error flows**                   | Insufficient stock; duplicate idempotency; forbidden                                   |
| **Authorization**                 | Staff+                                                                                 |
| **Database changes**              | Stock onHand; movements                                                                |
| **Events produced**               | Outbox: e.g. `inventory.stock.*`, `inventory.low-stock.detected` (when thresholds hit) |
| **Events consumed**               | None                                                                                   |
| **API endpoints**                 | `POST /api/v1/admin/inventory/stock/receive                                            | issue | adjust | return`                                    |
| **Response contract**             | Stock/movement DTOs                                                                    |
| **Idempotency rule**              | Required `idempotencyKey` (ADR-024 / contracts)                                        |
| **Postconditions**                | `available = onHand - reserved` updated                                                |
| **Automated test mapping**        | `inventory.service.spec.ts`, `inventory.concurrency.spec.ts`, `rabbitmq.smoke.spec.ts` |
| **Current implementation status** | **Implemented**                                                                        |
| **Known gaps**                    | —                                                                                      |

---

## UC-INV-05 — Reserve / release / commit reservation

| Field                             | Content                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-INV-05                                                                                                   |
| **Name**                          | Giữ / hoàn / trừ tồn đặt chỗ / Reserve-release-commit                                                       |
| **Actor**                         | A03 Staff+ (admin API); system callers from order/shipping with Staff headers                               |
| **Supporting actors/services**    | order-service (reserve on create, release on cancel); shipping-service (`commitOnPickup`)                   |
| **Preconditions**                 | `available >= qty`                                                                                          |
| **Trigger**                       | Order create / cancel / pickup commit / admin tools                                                         |
| **Input**                         | Reserve/commit/release bodies + `idempotencyKey`                                                            |
| **Main flow**                     | Reserve ↑`reserved`; release ↓`reserved`; commit ↓`onHand` & ↓`reserved`                                    |
| **Alternate flows**               | Admin direct `POST admin/inventory/stock/reserve`                                                           |
| **Error flows**                   | Insufficient available; already released/committed                                                          |
| **Authorization**                 | Staff+ on admin routes; inter-service uses Staff identity headers                                           |
| **Database changes**              | Reservation rows; stock reserved/onHand                                                                     |
| **Events produced**               | `inventory.reservation.created`, `.released`, `inventory.stock.committed`, `.returned`                      |
| **Events consumed**               | None (no Rabbit consumer in inventory-service)                                                              |
| **API endpoints**                 | `POST /api/v1/admin/inventory/stock/reserve`, `.../reservations/:id/release`, `.../reservations/:id/commit` |
| **Response contract**             | Reservation DTOs                                                                                            |
| **Idempotency rule**              | Required key; replay returns prior result                                                                   |
| **Postconditions**                | Reservation state terminal; available correct                                                               |
| **Automated test mapping**        | inventory concurrency + service specs; shipping pickup commit tests                                         |
| **Current implementation status** | **Implemented**                                                                                             |
| **Known gaps**                    | Warranty `inventory_return_requested` event not consumed by inventory                                       |

---

## UC-INV-06 — Transfer stock between locations

| Field                             | Content                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Use case ID**                   | UC-INV-06                                                              |
| **Name**                          | Điều chuyển tồn kho / Stock transfer                                   |
| **Actor**                         | A03 Staff+                                                             |
| **Supporting actors/services**    | inventory-service                                                      |
| **Preconditions**                 | Source has available qty                                               |
| **Trigger**                       | Admin transfer                                                         |
| **Input**                         | Transfer body + `idempotencyKey`                                       |
| **Main flow**                     | `POST /admin/inventory/transfers` moves stock across warehouses/stores |
| **Alternate flows**               | —                                                                      |
| **Error flows**                   | Insufficient; forbidden                                                |
| **Authorization**                 | Staff+                                                                 |
| **Database changes**              | Stock both sides; transfer record                                      |
| **Events produced**               | `inventory.transfer.*` outbox                                          |
| **Events consumed**               | None                                                                   |
| **API endpoints**                 | `POST /api/v1/admin/inventory/transfers`                               |
| **Response contract**             | Transfer DTO                                                           |
| **Idempotency rule**              | Required `idempotencyKey`                                              |
| **Postconditions**                | Quantities balanced                                                    |
| **Automated test mapping**        | inventory service specs                                                |
| **Current implementation status** | **Implemented**                                                        |
| **Known gaps**                    | —                                                                      |

---

## Domain summary

| Status      | Notes                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Implemented | Public reads; Staff mutations; reserve/commit/release; transfers; outbox publish |
| Formula     | `available = onHand - reserved`                                                  |
| Gap         | No consumer for warranty inventory-return events                                 |
