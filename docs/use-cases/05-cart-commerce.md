# 05 — Cart & Commerce Engagement Use Cases

Service: `cart-service`
Prefixes: `/api/v1/carts/*`, `/wishlist`, `/comparison`, `/recently-viewed`
Guest identity: `x-cart-token`; customer: `x-user-id`.

---

## UC-CART-01 — Create guest cart

| Field                             | Content                                           |
| --------------------------------- | ------------------------------------------------- |
| **Use case ID**                   | UC-CART-01                                        |
| **Name**                          | Tạo giỏ khách / Create guest cart                 |
| **Actor**                         | A01 Guest                                         |
| **Supporting actors/services**    | cart-service; storefront cookie/token             |
| **Preconditions**                 | None                                              |
| **Trigger**                       | First add-to-cart as guest                        |
| **Input**                         | Optional device metadata                          |
| **Main flow**                     | `POST /carts/guest` → issue cart token            |
| **Alternate flows**               | Reuse existing token                              |
| **Error flows**                   | Validation                                        |
| **Authorization**                 | Public                                            |
| **Database changes**              | Cart row (guest)                                  |
| **Events produced**               | `cart.cart.created` (outbox when configured)      |
| **Events consumed**               | None                                              |
| **API endpoints**                 | `POST /api/v1/carts/guest`                        |
| **Response contract**             | Cart DTO + token                                  |
| **Idempotency rule**              | Token-based continuity                            |
| **Postconditions**                | Guest can mutate with `x-cart-token`              |
| **Automated test mapping**        | `cart.controller.spec.ts`, `cart.service.spec.ts` |
| **Current implementation status** | **Implemented**                                   |
| **Known gaps**                    | Admin dedicated cart BFF key missing (see UC-BFF) |

---

## UC-CART-02 — Add / update / remove cart items

| Field                             | Content                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | -------- |
| **Use case ID**                   | UC-CART-02                                                                                                  |
| **Name**                          | Thêm / sửa / xóa dòng giỏ / Cart line mutations                                                             |
| **Actor**                         | A01 Guest, A02 Customer                                                                                     |
| **Supporting actors/services**    | cart-service; catalog price refresh                                                                         |
| **Preconditions**                 | Guest token or user id                                                                                      |
| **Trigger**                       | PDP / cart UI                                                                                               |
| **Input**                         | SKU + qty; headers identity                                                                                 |
| **Main flow**                     | `GET/POST/PATCH/DELETE /carts/current...`; `DELETE /carts/current` clear                                    |
| **Alternate flows**               | `POST /carts/current/refresh` reprice; `POST /carts/current/validate` pre-checkout                          |
| **Error flows**                   | Invalid SKU; qty; missing identity                                                                          |
| **Authorization**                 | Guest token XOR customer id                                                                                 |
| **Database changes**              | Cart items                                                                                                  |
| **Events produced**               | `cart.cart.item.added                                                                                       | updated | removed` |
| **Events consumed**               | None                                                                                                        |
| **API endpoints**                 | `/api/v1/carts/current`, `/current/items`, `/current/items/:skuId`, `/current/refresh`, `/current/validate` |
| **Response contract**             | Cart DTO                                                                                                    |
| **Idempotency rule**              | Add supports idempotency keys (Redis NX + DB per service)                                                   |
| **Postconditions**                | Cart totals updated                                                                                         |
| **Automated test mapping**        | cart unit/concurrency/integration/redis specs                                                               |
| **Current implementation status** | **Implemented**                                                                                             |
| **Known gaps**                    | —                                                                                                           |

---

## UC-CART-03 — Merge guest cart on login

| Field                             | Content                                                  |
| --------------------------------- | -------------------------------------------------------- |
| **Use case ID**                   | UC-CART-03                                               |
| **Name**                          | Gộp giỏ khi đăng nhập / Merge guest → customer           |
| **Actor**                         | A02 Customer                                             |
| **Supporting actors/services**    | cart-service; storefront after login                     |
| **Preconditions**                 | Guest token + authenticated user                         |
| **Trigger**                       | Login success                                            |
| **Input**                         | `x-user-id` + `x-cart-token` + optional `idempotencyKey` |
| **Main flow**                     | `POST /carts/merge` merges lines into customer cart      |
| **Alternate flows**               | Empty guest cart no-op                                   |
| **Error flows**                   | Conflict rules / validation                              |
| **Authorization**                 | Customer required                                        |
| **Database changes**              | Customer cart items; guest cart retired                  |
| **Events produced**               | `cart.cart.merged`                                       |
| **Events consumed**               | None                                                     |
| **API endpoints**                 | `POST /api/v1/carts/merge`                               |
| **Response contract**             | Merged cart DTO                                          |
| **Idempotency rule**              | Supported via idempotency key                            |
| **Postconditions**                | Single customer cart                                     |
| **Automated test mapping**        | `cart.service.spec.ts`                                   |
| **Current implementation status** | **Implemented**                                          |
| **Known gaps**                    | —                                                        |

---

## UC-CART-04 — Convert cart after order

| Field                             | Content                                             |
| --------------------------------- | --------------------------------------------------- |
| **Use case ID**                   | UC-CART-04                                          |
| **Name**                          | Chuyển đổi giỏ sau đặt hàng / Convert cart          |
| **Actor**                         | A02 Customer (system/order flow via BFF)            |
| **Supporting actors/services**    | cart-service; order-service after create            |
| **Preconditions**                 | Order created successfully                          |
| **Trigger**                       | Post-checkout convert call                          |
| **Input**                         | Convert payload + idempotency                       |
| **Main flow**                     | `POST /carts/convert` marks/consumes cart for order |
| **Alternate flows**               | —                                                   |
| **Error flows**                   | Empty cart; already converted                       |
| **Authorization**                 | Customer / caller headers                           |
| **Database changes**              | Cart converted state                                |
| **Events produced**               | `cart.cart.converted`                               |
| **Events consumed**               | None                                                |
| **API endpoints**                 | `POST /api/v1/carts/convert`                        |
| **Response contract**             | Convert result DTO                                  |
| **Idempotency rule**              | Idempotency key supported                           |
| **Postconditions**                | Cart not double-checked-out                         |
| **Automated test mapping**        | cart service specs                                  |
| **Current implementation status** | **Implemented**                                     |
| **Known gaps**                    | —                                                   |

---

## UC-CART-05 — Wishlist

| Field                             | Content                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-CART-05                                                                           |
| **Name**                          | Danh sách yêu thích / Wishlist                                                       |
| **Actor**                         | A02 Customer                                                                         |
| **Supporting actors/services**    | cart-service                                                                         |
| **Preconditions**                 | `x-user-id`                                                                          |
| **Trigger**                       | Heart / wishlist page                                                                |
| **Input**                         | `productId`                                                                          |
| **Main flow**                     | `GET/POST /wishlist`, `DELETE /wishlist/:productId` — capped by `WISHLIST_MAX_ITEMS` |
| **Alternate flows**               | Cap reached → error                                                                  |
| **Error flows**                   | Unauthenticated; over capacity                                                       |
| **Authorization**                 | Customer required                                                                    |
| **Database changes**              | Wishlist rows                                                                        |
| **Events produced**               | None dedicated (unless shared cart events — not required)                            |
| **Events consumed**               | None                                                                                 |
| **API endpoints**                 | `/api/v1/wishlist`                                                                   |
| **Response contract**             | Wishlist DTO                                                                         |
| **Idempotency rule**              | Add is effectively upsert by product                                                 |
| **Postconditions**                | Product on wishlist                                                                  |
| **Automated test mapping**        | `cart.service.spec.ts` / controller                                                  |
| **Current implementation status** | **Implemented**                                                                      |
| **Known gaps**                    | —                                                                                    |

---

## UC-CART-06 — Product comparison

| Field                             | Content                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-CART-06                                                                                  |
| **Name**                          | So sánh sản phẩm / Comparison list                                                          |
| **Actor**                         | A02 Customer (auth required by controller)                                                  |
| **Supporting actors/services**    | cart-service; storefront compare UI (clear-all supported)                                   |
| **Preconditions**                 | Login                                                                                       |
| **Trigger**                       | Add to compare                                                                              |
| **Input**                         | `productId`                                                                                 |
| **Main flow**                     | `GET/POST /comparison`, `DELETE /:productId`, `DELETE /` clear-all — `COMPARISON_MAX_ITEMS` |
| **Alternate flows**               | Clear all                                                                                   |
| **Error flows**                   | Cap exceeded; unauthenticated                                                               |
| **Authorization**                 | Customer                                                                                    |
| **Database changes**              | Comparison rows                                                                             |
| **Events produced**               | None                                                                                        |
| **Events consumed**               | None                                                                                        |
| **API endpoints**                 | `/api/v1/comparison`                                                                        |
| **Response contract**             | Comparison DTO                                                                              |
| **Idempotency rule**              | Upsert by product                                                                           |
| **Postconditions**                | Compare set updated                                                                         |
| **Automated test mapping**        | cart specs                                                                                  |
| **Current implementation status** | **Implemented**                                                                             |
| **Known gaps**                    | —                                                                                           |

---

## UC-CART-07 — Recently viewed

| Field                             | Content                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| **Use case ID**                   | UC-CART-07                                                              |
| **Name**                          | Sản phẩm đã xem / Recently viewed                                       |
| **Actor**                         | A01 Guest, A02 Customer                                                 |
| **Supporting actors/services**    | cart-service                                                            |
| **Preconditions**                 | Guest token or user                                                     |
| **Trigger**                       | PDP view                                                                |
| **Input**                         | Product id                                                              |
| **Main flow**                     | `POST /recently-viewed` then `GET` — capped `RECENTLY_VIEWED_MAX_ITEMS` |
| **Alternate flows**               | —                                                                       |
| **Error flows**                   | Missing identity                                                        |
| **Authorization**                 | Guest token or user                                                     |
| **Database changes**              | Recently viewed rows                                                    |
| **Events produced**               | None                                                                    |
| **Events consumed**               | None                                                                    |
| **API endpoints**                 | `/api/v1/recently-viewed`                                               |
| **Response contract**             | Product id list / DTOs                                                  |
| **Idempotency rule**              | Recency reorder on re-view                                              |
| **Postconditions**                | Product at head of list                                                 |
| **Automated test mapping**        | cart specs                                                              |
| **Current implementation status** | **Implemented**                                                         |
| **Known gaps**                    | —                                                                       |

---

## Domain summary

| Status      | Notes                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Implemented | Guest cart, merge, convert, wishlist, comparison, recently-viewed                                  |
| Partial     | Reporting docs may list cart events as consumers — reporting code does **not** consume cart events |
| Gap         | Admin-web `cart` BFF dedicated route not in `AdminServiceKey`                                      |
