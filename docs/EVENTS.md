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

| Event type                       | Routing key                              | Producer            | Consumers                                   |
| -------------------------------- | ---------------------------------------- | ------------------- | ------------------------------------------- |
| `user.registered`                | `identity.user.registered`               | identity            | customer, notification                      |
| `user.email_verified`            | `identity.user.email_verified`           | identity            | notification                                |
| `user.password_reset_requested`  | `identity.user.password_reset_requested` | identity            | notification                                |
| `customer.profile_created`       | `customer.profile.created`               | customer            | reporting                                   |
| `catalog.product_updated`        | `catalog.product.updated`                | catalog             | reporting, search cache (nếu có)            |
| `catalog.price_changed`          | `catalog.price.changed`                  | catalog             | reporting                                   |
| `catalog.category_updated`       | `catalog.category.updated`               | catalog             | reporting                                   |
| `catalog.brand_updated`          | `catalog.brand.updated`                  | catalog             | reporting                                   |
| `inventory.reservation.created`  | `inventory.reservation.created`          | inventory           | order                                       |
| `inventory.reservation.released` | `inventory.reservation.released`         | inventory           | order                                       |
| `inventory.stock.committed`      | `inventory.stock.committed`              | inventory           | order, reporting                            |
| `inventory.stock.returned`       | `inventory.stock.returned`               | inventory           | order, reporting                            |
| `inventory.transfer.created`     | `inventory.transfer.created`             | inventory           | reporting                                   |
| `inventory.transfer.completed`   | `inventory.transfer.completed`           | inventory           | reporting                                   |
| `inventory.low-stock.detected`   | `inventory.low-stock.detected`           | inventory           | notification, reporting                     |
| `cart.created`                   | `cart.cart.created`                      | cart                | reporting                                   |
| `cart.item.added`                | `cart.cart.item.added`                   | cart                | reporting                                   |
| `cart.item.updated`              | `cart.cart.item.updated`                 | cart                | reporting                                   |
| `cart.item.removed`              | `cart.cart.item.removed`                 | cart                | reporting                                   |
| `cart.merged`                    | `cart.cart.merged`                       | cart                | reporting                                   |
| `cart.converted`                 | `cart.cart.converted`                    | cart                | reporting                                   |
| `cart.expired`                   | `cart.cart.expired`                      | cart                | reporting                                   |
| `order.created`                  | `order.order.created`                    | order               | payment, inventory, notification, reporting |
| `order.cancelled`                | `order.order.cancelled`                  | order               | inventory, payment, notification            |
| `order.fulfilled`                | `order.order.fulfilled`                  | order               | notification, reporting, review-eligibility |
| `payment.initiated`              | `payment.payment.initiated`              | payment             | order, reporting                            |
| `payment.succeeded`              | `payment.payment.succeeded`              | payment             | order, notification, reporting              |
| `payment.failed`                 | `payment.payment.failed`                 | payment             | order, notification                         |
| `shipment.created`               | `shipping.shipment.created`              | shipping            | order, notification                         |
| `shipment.in_transit`            | `shipping.shipment.in_transit`           | shipping            | order, notification                         |
| `shipment.delivered`             | `shipping.shipment.delivered`            | shipping            | order, notification, warranty               |
| `review.created`                 | `review.review.created`                  | review              | notification, reporting                     |
| `warranty.claim_created`         | `warranty.claim.created`                 | warranty            | notification, support (optional)            |
| `support.ticket_created`         | `support.ticket.created`                 | support             | notification                                |
| `support.ticket_updated`         | `support.ticket.updated`                 | support             | notification                                |
| `audit.recorded`                 | `reporting.audit.recorded`               | various → reporting | reporting                                   |
| `media.uploaded`                 | `media.media.uploaded`                   | media               | catalog/review/support (bind by ownerType)  |
| `media.deleted`                  | `media.media.deleted`                    | media               | catalog/review/support                      |
| `notification.requested`         | `notification.message.requested`         | various             | notification                                |

## Consumer guidelines

1. Idempotent theo `eventId` (inbox table hoặc Redis set có TTL dài)
2. Không chặn HTTP request để chờ side-effect không cần thiết
3. Retry với DLQ sau N lần
4. Payload schema version hóa trong `libs/shared/events`

## Outbox pattern

Các service ghi sự kiện quan trọng dùng transactional outbox (cùng transaction Prisma) rồi publisher đẩy lên RabbitMQ — ưu tiên cho order/payment/inventory.
