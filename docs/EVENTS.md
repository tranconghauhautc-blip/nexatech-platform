# NexaTech Events

## Broker

- RabbitMQ
- Exchange type: `topic`
- Exchange name: `nexatech.events`
- Dead-letter: `nexatech.events.dlx`
- Message format: JSON
- Headers bắt buộc: `traceId`, `eventId`, `occurredAt`, `producer`

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "order.created",
  "occurredAt": "2026-07-29T12:00:00.000Z",
  "producer": "order-service",
  "traceId": "uuid",
  "payload": {}
}
```

## Routing keys chính

| Event type                            | Routing key                              | Producer            | Consumers                                    |
| ------------------------------------- | ---------------------------------------- | ------------------- | -------------------------------------------- |
| `user.registered`                     | `identity.user.registered`               | identity            | customer, notification                       |
| `user.email_verified`                 | `identity.user.email_verified`           | identity            | notification                                 |
| `user.password_reset_requested`       | `identity.user.password_reset_requested` | identity            | notification                                 |
| `customer.profile_created`            | `customer.profile.created`               | customer            | reporting                                    |
| `catalog.product_updated`             | `catalog.product.updated`                | catalog             | reporting, search cache (nếu có)             |
| `catalog.price_changed`               | `catalog.price.changed`                  | catalog             | reporting                                    |
| `catalog.category_updated`            | `catalog.category.updated`               | catalog             | reporting                                    |
| `catalog.brand_updated`               | `catalog.brand.updated`                  | catalog             | reporting                                    |
| `inventory.reservation.created`       | `inventory.reservation.created`          | inventory           | order                                        |
| `inventory.reservation.released`      | `inventory.reservation.released`         | inventory           | order                                        |
| `inventory.stock.committed`           | `inventory.stock.committed`              | inventory           | order, reporting                             |
| `inventory.stock.returned`            | `inventory.stock.returned`               | inventory           | order, reporting                             |
| `inventory.transfer.created`          | `inventory.transfer.created`             | inventory           | reporting                                    |
| `inventory.transfer.completed`        | `inventory.transfer.completed`           | inventory           | reporting                                    |
| `inventory.low-stock.detected`        | `inventory.low-stock.detected`           | inventory           | notification, reporting                      |
| `cart.created`                        | `cart.cart.created`                      | cart                | reporting                                    |
| `cart.item.added`                     | `cart.cart.item.added`                   | cart                | reporting                                    |
| `cart.item.updated`                   | `cart.cart.item.updated`                 | cart                | reporting                                    |
| `cart.item.removed`                   | `cart.cart.item.removed`                 | cart                | reporting                                    |
| `cart.merged`                         | `cart.cart.merged`                       | cart                | reporting                                    |
| `cart.converted`                      | `cart.cart.converted`                    | cart                | reporting                                    |
| `cart.expired`                        | `cart.cart.expired`                      | cart                | reporting                                    |
| `order.created`                       | `order.order.created`                    | order               | payment, inventory, notification, reporting  |
| `order.confirmed`                     | `order.order.confirmed`                  | order               | payment, notification, reporting             |
| `order.status.changed`                | `order.order.status.changed`             | order               | notification, reporting                      |
| `order.cancelled`                     | `order.order.cancelled`                  | order               | inventory, payment, notification             |
| `order.package.created`               | `order.order.package.created`            | order               | shipping, reporting                          |
| `order.ready-to-ship`                 | `order.order.ready-to-ship`              | order               | shipping, notification                       |
| `order.shipped`                       | `order.order.shipped`                    | order               | shipping, notification, reporting            |
| `order.delivered`                     | `order.order.delivered`                  | order               | notification, reporting, review-eligibility  |
| `order.return.requested`              | `order.order.return.requested`           | order               | warranty, notification                       |
| `order.returned`                      | `order.order.returned`                   | order               | inventory, notification, reporting           |
| `order.failed`                        | `order.order.failed`                     | order               | inventory, notification, reporting           |
| `order.fulfilled`                     | `order.order.fulfilled`                  | order               | alias legacy ≈ delivered                     |
| `payment.initiated`                   | `payment.payment.initiated`              | payment             | order, reporting (legacy alias)              |
| `payment.created`                     | `payment.payment.created`                | payment             | order, reporting                             |
| `payment.pending`                     | `payment.payment.pending`                | payment             | order, reporting                             |
| `payment.processing`                  | `payment.payment.processing`             | payment             | order, reporting                             |
| `payment.paid`                        | `payment.payment.paid`                   | payment             | order, notification, reporting               |
| `payment.succeeded`                   | `payment.payment.succeeded`              | payment             | order, notification, reporting (legacy)      |
| `payment.failed`                      | `payment.payment.failed`                 | payment             | order, notification                          |
| `payment.cancelled`                   | `payment.payment.cancelled`              | payment             | order, reporting                             |
| `payment.expired`                     | `payment.payment.expired`                | payment             | order, reporting                             |
| `payment.refund.requested`            | `payment.payment.refund.requested`       | payment             | order, notification, reporting               |
| `payment.refunded`                    | `payment.payment.refunded`               | payment             | order, notification, reporting               |
| `payment.partially-refunded`          | `payment.payment.partially-refunded`     | payment             | order, notification, reporting               |
| `shipping.quote.created`              | `shipping.quote.created`                 | shipping            | notification                                 |
| `shipping.slot.reserved`              | `shipping.slot.reserved`                 | shipping            | notification                                 |
| `shipping.slot.released`              | `shipping.slot.released`                 | shipping            | notification                                 |
| `shipment.created`                    | `shipping.shipment.created`              | shipping            | order, notification                          |
| `shipment.booked`                     | `shipping.shipment.booked`               | shipping            | order, notification                          |
| `shipment.ready-for-pickup`           | `shipping.shipment.ready-for-pickup`     | shipping            | order, notification                          |
| `shipment.picked-up`                  | `shipping.shipment.picked-up`            | shipping            | inventory, order, notification               |
| `shipment.in-transit`                 | `shipping.shipment.in-transit`           | shipping            | order, notification                          |
| `shipment.out-for-delivery`           | `shipping.shipment.out-for-delivery`     | shipping            | order, notification                          |
| `shipment.delivered`                  | `shipping.shipment.delivered`            | shipping            | order, payment (COD), notification, warranty |
| `shipment.delivery-failed`            | `shipping.shipment.delivery-failed`      | shipping            | order, notification                          |
| `shipment.cancelled`                  | `shipping.shipment.cancelled`            | shipping            | order, notification                          |
| `shipment.return-to-sender`           | `shipping.shipment.return-to-sender`     | shipping            | order, notification                          |
| `shipment.returned`                   | `shipping.shipment.returned`             | shipping            | order, notification                          |
| `shipment.tracking.updated`           | `shipping.shipment.tracking.updated`     | shipping            | notification                                 |
| `review.created`                      | `review.review.created`                  | review              | notification, reporting                      |
| `review.published`                    | `review.review.published`                | review              | catalog, notification, reporting             |
| `review.updated`                      | `review.review.updated`                  | review              | notification, reporting                      |
| `review.hidden`                       | `review.review.hidden`                   | review              | catalog, notification                        |
| `review.rejected`                     | `review.review.rejected`                 | review              | notification                                 |
| `review.deleted`                      | `review.review.deleted`                  | review              | catalog, media (unlink ref), reporting       |
| `review.reply.created`                | `review.review.reply.created`            | review              | notification                                 |
| `review.reply.updated`                | `review.review.reply.updated`            | review              | notification                                 |
| `review.reply.deleted`                | `review.review.reply.deleted`            | review              | notification                                 |
| `review.report.created`               | `review.review.report.created`           | review              | notification (moderation)                    |
| `review.report.resolved`              | `review.review.report.resolved`          | review              | reporting                                    |
| `review.helpful.added`                | `review.review.helpful.added`            | review              | reporting                                    |
| `review.helpful.removed`              | `review.review.helpful.removed`          | review              | reporting                                    |
| `review.rating-aggregate.updated`     | `review.review.rating-aggregate.updated` | review              | catalog                                      |
| `warranty.claim_created`              | `warranty.claim.created`                 | warranty            | notification, support (optional)             |
| `warranty.claim_updated`              | `warranty.claim.updated`                 | warranty            | notification                                 |
| `warranty.claim_approved`             | `warranty.claim.approved`                | warranty            | notification                                 |
| `warranty.claim_rejected`             | `warranty.claim.rejected`                | warranty            | notification                                 |
| `warranty.claim_completed`            | `warranty.claim.completed`               | warranty            | notification, reporting                      |
| `warranty.claim_cancelled`            | `warranty.claim.cancelled`               | warranty            | notification                                 |
| `warranty.return_requested`           | `warranty.return.requested`              | warranty            | notification                                 |
| `warranty.return_updated`             | `warranty.return.updated`                | warranty            | notification                                 |
| `warranty.return_approved`            | `warranty.return.approved`               | warranty            | notification                                 |
| `warranty.return_rejected`            | `warranty.return.rejected`               | warranty            | notification                                 |
| `warranty.return_completed`           | `warranty.return.completed`              | warranty            | notification, reporting                      |
| `warranty.return_cancelled`           | `warranty.return.cancelled`              | warranty            | notification                                 |
| `warranty.refund_requested`           | `warranty.refund.requested`              | warranty            | payment (contract only, chưa consume)        |
| `warranty.inventory_return_requested` | `warranty.inventory-return.requested`    | warranty            | inventory (contract only, chưa consume)      |
| `support.ticket_created`              | `support.ticket.created`                 | support             | notification                                 |
| `support.ticket_updated`              | `support.ticket.updated`                 | support             | notification                                 |
| `support.ticket_assigned`             | `support.ticket.assigned`                | support             | notification                                 |
| `support.ticket_resolved`             | `support.ticket.resolved`                | support             | notification, reporting                      |
| `support.ticket_closed`               | `support.ticket.closed`                  | support             | notification, reporting                      |
| `support.ticket_cancelled`            | `support.ticket.cancelled`               | support             | notification                                 |
| `support.ticket_message_added`        | `support.ticket.message.added`           | support             | notification                                 |
| `audit.recorded`                      | `reporting.audit.recorded`               | various → reporting | reporting                                    |
| `media.uploaded`                      | `media.media.uploaded`                   | media               | catalog/review/support (bind by ownerType)   |
| `media.deleted`                       | `media.media.deleted`                    | media               | catalog/review/support                       |
| `notification.requested`              | `notification.message.requested`         | various             | notification                                 |

## Consumer guidelines

1. Idempotent theo `eventId` (inbox table hoặc Redis set có TTL dài)
2. Không chặn HTTP request để chờ side-effect không cần thiết
3. Retry với DLQ sau N lần
4. Payload schema version hóa trong `libs/shared/events`

## Outbox pattern

Các service ghi sự kiện quan trọng dùng transactional outbox (cùng transaction Prisma) rồi publisher đẩy lên RabbitMQ — **order-service (M7)**, **payment-service (M8)**, **shipping-service (M9)**, **review-service (M10)**, **warranty-service (M11)** và **support-service (M12)** đã triển khai `OutboxEvent` + dispatcher sau commit; inventory/cart publish trực tiếp khi có `RABBITMQ_URL`.

## Order consume / gọi sync (M7)

- Sync REST: cart refresh/validate/convert; catalog SKU price; inventory reserve/release.
- Events inventory (`reservation.created` / `released` / `stock.committed`) do inventory-service emit; order gọi REST reserve/release và lưu `reservationId`.
- Cart convert emit `cart.converted` sau khi order local TX + reservation thành công.

## Payment integrate (M8)

- Sync REST tới order: `GET /orders/:id`, `POST /orders/:id/payment-sync` (Staff+).
- Khi `payment.paid`: cập nhật order `paymentStatus=PAID` + `confirmOrder` nếu cần; không distributed TX — local outbox + retry-safe (`orderSyncedAt`).

## Shipping integrate (M9)

- Sync REST tới order: `GET /orders/:id`, `POST /orders/:id/shipping-sync` (Staff+).
- Khi `shipment.delivered`: cập nhật package + có thể `orderStatus=DELIVERED`; COD có thể consume event để thu tiền.
- Inventory: commit stock khi `shipment.picked-up` (một lần qua `stockCommittedAt`).
- Mock provider mặc định; GHN skeleton cần `GHN_TOKEN` / `GHN_SHOP_ID` / `GHN_BASE_URL`.
- Khi fail/expire: cập nhật payment status + event; **không** tự huỷ order.
- Consume hooks (method): `order.cancelled`, `order.delivered` (COD thu tiền khi giao).
- Publish chỉ sau local transaction thành công (outbox).

## Review integrate (M10)

- Sync REST: `GET /orders/:id` (verified buyer), `GET /products/:id` (catalog), `GET /media/:id` (ownership/MIME).
- Publish outbox: `review.*` lifecycle, reply, report, helpful, `rating-aggregate.updated`.
- Không sửa DB catalog; catalog có thể consume aggregate event sau.
- Verified buyer: order + package DELIVERED; một active review / orderItem; soft-delete cho phép đánh giá lại.
- Publish chỉ sau local transaction thành công (outbox).

## Warranty integrate (M11)

- Sync REST: `GET /orders/:id` (verified buyer), `GET /media/:id` (ownership/MIME image/\*).
- Order sync (một chiều, có retry, không distributed TX): `POST /orders/:id/return-sync` khi return APPROVED (`RETURN_REQUESTED`), COMPLETED (`RETURNED`), hoặc REJECTED/CANCELLED sau khi đã sync (`DELIVERED`); gọi trước khi persist local state, rollback nếu sync lỗi (`WARRANTY_ORDER_SYNC_FAILED`).
- Publish outbox: `warranty.claim_*` (created/updated/approved/rejected/completed/cancelled), `warranty.return_*` (requested/updated/approved/rejected/completed/cancelled).
- `warranty.refund_requested` (khi return COMPLETED + `desiredResolution=REFUND`) và `warranty.inventory_return_requested` (khi return `mark_received`) chỉ là **event hợp đồng** — payment-service/inventory-service tự consume; warranty-service không gọi HTTP các service này.
- Verified buyer: order + package DELIVERED; một active claim và một active return / orderItem (`activeKey`); soft cancel rotate key cho phép tạo yêu cầu mới.
- Publish chỉ sau local transaction thành công (outbox).

## Support integrate (M12)

- Sync REST (optional): `GET /orders/:id` khi ticket có `orderId` — ownership check; `GET /media/:id` cho attachment.
- Liên kết `warrantyClaimId` / `returnRequestId` chỉ lưu ID (không gọi warranty REST bắt buộc trong M12).
- Publish outbox: `support.ticket_created|updated|assigned|resolved|closed|cancelled|message_added`.
- Không truy cập DB order/warranty/media; không distributed TX.
- Publish chỉ sau local transaction thành công (outbox).
