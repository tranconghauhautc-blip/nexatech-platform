# NexaTech Databases

## Nguyên tắc

- PostgreSQL 16
- Database **per service**
- Prisma ORM + **migrations** (không `db push` production)
- Application role riêng (không dùng superuser `postgres` cho app)
- Không FK cross-service

## Trạng thái persistence sau M14

| Thành phần                | Trạng thái                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| Prisma schema identity    | ✅ Có — chưa wire runtime                                                  |
| Prisma schema customer    | ✅ Có — chưa wire runtime                                                  |
| Prisma schema catalog     | ✅ Có + migration `20260729120000_init_catalog`                            |
| Prisma schema media       | ✅ Có + migration `20260729130000_init_media`                              |
| Prisma schema inventory   | ✅ Có + migration `20260729140000_init_inventory`                          |
| Prisma schema cart        | ✅ Có + migration `20260729160000_init_cart`                               |
| Prisma schema order       | ✅ Có + migration `20260730000000_init_order`                              |
| Runtime identity/customer | In-memory (M3)                                                             |
| Runtime catalog           | **Prisma** khi `CATALOG_DATABASE_URL`; InMemory chỉ unit/`NODE_ENV=test`   |
| Runtime media             | **Prisma** khi `MEDIA_DATABASE_URL`; MinIO khi `MINIO_*`                   |
| Runtime inventory         | **Prisma** khi `INVENTORY_DATABASE_URL`; InMemory chỉ unit/`NODE_ENV=test` |
| Runtime cart              | **Prisma** khi `CART_DATABASE_URL`; Redis hỗ trợ idempotency/lock/TTL      |
| Runtime order             | **Prisma** khi `ORDER_DATABASE_URL`; outbox + RabbitMQ                     |
| Redis                     | Compose sẵn; cart dùng cho idempotency/lock; identity chưa wire            |
| MinIO                     | Compose + buckets init; media-service dùng thật                            |

## Env database

| Biến                     | Mục đích           |
| ------------------------ | ------------------ |
| `IDENTITY_DATABASE_URL`  | Postgres identity  |
| `CUSTOMER_DATABASE_URL`  | Postgres customer  |
| `CATALOG_DATABASE_URL`   | Postgres catalog   |
| `MEDIA_DATABASE_URL`     | Postgres media     |
| `INVENTORY_DATABASE_URL` | Postgres inventory |
| `CART_DATABASE_URL`      | Postgres cart      |
| `ORDER_DATABASE_URL`     | Postgres order     |
| `REPORTING_DATABASE_URL` | Postgres reporting |
| `REDIS_URL`              | Redis              |
| `RABBITMQ_URL`           | RabbitMQ           |
| `MINIO_*`                | Object storage     |
| `CATALOG_SERVICE_URL`    | REST catalog       |
| `INVENTORY_SERVICE_URL`  | REST inventory     |
| `CART_SERVICE_URL`       | REST cart (order)  |

Init Compose (`infra/docker/postgres/init-databases.sql`):

- Users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media`, `nexatech_inventory`, `nexatech_cart`, `nexatech_order`, `nexatech_payment`, `nexatech_shipping`, `nexatech_review`, `nexatech_warranty`, `nexatech_support`, `nexatech_notification`, `nexatech_reporting` (password dev `changeme`)
- DBs cùng tên tương ứng

## Danh sách database

| Service              | Database name           | Schema status                                     |
| -------------------- | ----------------------- | ------------------------------------------------- |
| identity-service     | `nexatech_identity`     | Prisma schema ✅ / runtime in-memory              |
| customer-service     | `nexatech_customer`     | Prisma schema ✅ / runtime in-memory              |
| catalog-service      | `nexatech_catalog`      | Prisma + migration ✅ / Prisma repository runtime |
| media-service        | `nexatech_media`        | Prisma + migration ✅ / Prisma repository runtime |
| inventory-service    | `nexatech_inventory`    | Prisma + migration ✅ / Prisma repository runtime |
| cart-service         | `nexatech_cart`         | Prisma + migration ✅ / Prisma + Redis assist     |
| order-service        | `nexatech_order`        | Prisma + migration ✅ / Prisma + outbox runtime   |
| payment-service      | `nexatech_payment`      | Prisma + migration ✅ / Prisma + outbox runtime   |
| shipping-service     | `nexatech_shipping`     | Prisma + migration ✅ / Prisma + outbox runtime   |
| review-service       | `nexatech_review`       | Prisma + migration ✅ / Prisma + outbox runtime   |
| warranty-service     | `nexatech_warranty`     | Prisma + migration ✅ / Prisma + outbox runtime   |
| support-service      | `nexatech_support`      | Prisma + migration ✅ / Prisma + outbox runtime   |
| notification-service | `nexatech_notification` | Prisma + migration ✅ / Prisma + inbox consumer   |
| reporting-service    | `nexatech_reporting`    | Prisma + migration ✅ / Prisma + inbox consumer   |

## catalog — Prisma models (M4)

- `Category` — tree `parentId`, slug unique
- `Brand` — slug unique
- `SpecTemplate` / `SpecGroup` / `SpecAttribute` — template thông số theo danh mục
- `Product` — slug, status enum, `searchText` (+ `searchVector` tsvector trong migration SQL)
- `ProductSpecValue` — giá trị thuộc tính
- `Variant` / `Sku` — biến thể và SKU
- `Price` + `PriceHistory`
- `ProductMediaLink` — liên kết mediaId (thumbnail/gallery/video)

Client: `apps/catalog-service/src/generated/prisma` (gitignore; `pnpm exec nx run catalog-service:prisma-generate`).

## media — Prisma models (M4)

- `MediaObject` — bucket, objectKey, contentType, sizeBytes, status (`PENDING`/`ACTIVE`/`DELETED`), ownerType/ownerId, uploadedBy
- `MediaLink` — entityType product/sku/review, role, isPrimary
- `MediaAuditLog` — audit thao tác media

Client: `apps/media-service/src/generated/prisma`.

## inventory — Prisma models (M5)

- `Warehouse` / `Store` — vị trí kho vật lý và cửa hàng (store có thể liên kết `warehouseId`)
- `StockItem` — tồn theo `(skuCode, locationType, locationId)`, `onHand`/`reserved`/`version` (optimistic lock) + `lowStockThreshold`
- `Reservation` + `ReservationLine` — giữ hàng theo idempotency key, nhiều dòng nhiều vị trí
- `StockMovement` — nhật ký IN/OUT/RESERVE/RELEASE/COMMIT/RETURN/TRANSFER_OUT/TRANSFER_IN/ADJUST
- `Transfer` — điều chuyển giữa hai vị trí (PENDING → COMPLETED trong cùng luồng M5)
- `IdempotencyRecord` — lưu response theo key cho các API mutation
- `AuditLog` — nhật ký thao tác nhạy cảm (stocktake, tạo kho/cửa hàng)

Client: `apps/inventory-service/src/generated/prisma`. Optimistic lock: `UPDATE ... WHERE id=? AND version=?`, retry tối đa 3 lần trước khi trả `INVENTORY_CONFLICT`.

## cart — Prisma models (M6)

- `Cart` — `ownerType` GUEST/CUSTOMER, `guestTokenHash`, `customerId`, `status` (ACTIVE/CONVERTED/EXPIRED/ABANDONED), `version` (optimistic lock), `expiresAt`
- `CartItem` — `skuId`/`skuCode`, `quantity`, `unitPriceSnapshot` (hiển thị), product metadata; unique `(cartId, skuId)`
- `WishlistItem` / `ComparisonItem` / `RecentlyViewedItem`
- `IdempotencyRecord` / `AuditLog`
- Partial unique indexes (SQL): một ACTIVE cart / customer; một ACTIVE cart / guestTokenHash

Client: `apps/cart-service/src/generated/prisma`. Redis: idempotency NX, lock `cart:lock:*`, guest token meta TTL.

## order — Prisma models (M7)

- `Order` — `orderCode` unique (không dùng DB id thô), `customerId`, customer snapshot fields, status machine, `version` optimistic lock, `cartId`, `reservationId`, delivery/payment fields, totals (Int VND), `inventoryReleased`, `refundContractStatus`
- `OrderItem` — snapshot SKU/product/attributes/unitPrice/quantity/lineSubtotal
- `OrderAddressSnapshot` — địa chỉ giao hàng full text
- `OrderStatusHistory` — from/to, actor, reason, timestamp
- `OrderPackage` + `OrderPackageItem` — split theo nguồn kho/cửa hàng từ reservation
- `OrderIdempotency` — create/cancel/transition
- `OutboxEvent` — transactional outbox trước khi publish RabbitMQ
- `AuditLog` — thao tác nhạy cảm

Client: `apps/order-service/src/generated/prisma`.

## payment — Prisma models (M8)

- `Payment` — `paymentReference` unique, `orderId`/`orderCode`/`customerId`, provider/method, lifecycle status, `amount`/`amountRefunded` (Int VND), `checkoutUrl`, `expiresAt`, `paidAt`, `version`, `orderSyncedAt`
- `PaymentAttempt` — lần thử với provider
- `PaymentTransaction` — CHARGE/REFUND/ADJUSTMENT
- `PaymentCallback` — payloadHash unique theo provider (chống replay), `signatureValid`, sanitized payload
- `Refund` — amount/reason/status/`refundReference`, idempotencyKey
- `PaymentIdempotency` / `OutboxEvent` / `AuditLog`

Client: `apps/payment-service/src/generated/prisma`. Money: integer VND; VNPay `vnp_Amount = amount * 100`.

## shipping — Prisma models (M9)

- `ShippingQuote` — order snapshot, deliveryMethod, totalFee/packageFees (Int VND), provider, expiresAt, status
- `DeliverySlot` — date/window, capacity/reservedCount, cutoffAt, version optimistic
- `DeliverySlotReservation` — HELD/RELEASED/CONSUMED, idempotencyKey unique
- `Shipment` — per packageId unique, status machine, trackingCode, pickupCodeHash/hint, orderSyncedAt, stockCommittedAt, version
- `ShipmentItem`, `ShipmentStatusHistory`, `TrackingEvent`
- `ProviderCallback` — unique (provider, payloadHash)
- `ShipmentIdempotency`, `OutboxEvent`, `AuditLog`

Client: `apps/shipping-service/src/generated/prisma`. Money: integer VND.

## review — Prisma models (M10)

- `Review` — product/sku/order/orderItem, customerId, rating 1–5, content, status machine, `activeKey` unique, `version`, soft-delete via status+rotated activeKey
- `ReviewMedia` — mediaId reference + kind IMAGE/VIDEO, soft unlink (`deletedAt`)
- `ReviewReply` — một reply active / review (`activeKey`), soft-delete
- `ReviewHelpfulVote` — unique `(reviewId, customerId)`
- `ReviewReport` — reason/status + `activeKey` chống duplicate OPEN/REVIEWING
- `ReviewModerationHistory` — from/to/action/actor/reason
- `ProductRatingAggregate` — sumRating, counts star1–5, verified/media counts, version
- `ReviewIdempotency`, `OutboxEvent`, `AuditLog`

Client: `apps/review-service/src/generated/prisma`. Aggregate: `averageRatingCents = round(sumRating * 100 / totalReviews)`.

## warranty — Prisma models (M11)

- `WarrantyClaim` — order/orderItem/customer/product/sku snapshot, `claimCode` unique (`NT-W-YYYYMMDD-XXXXXX`), `issueType`, status machine (SUBMITTED→UNDER_REVIEW→APPROVED→IN_PROGRESS→COMPLETED, REJECTED/CANCELLED), `activeKey` unique (`customerId:orderItemId`, rotates on terminal), `version` optimistic lock, `orderSyncedStatus`/`orderSyncedAt` (không dùng cho claim, chỉ return)
- `WarrantyClaimMedia` — mediaId reference, kind IMAGE only, soft `deletedAt`
- `WarrantyClaimHistory` — from/to/action/actor/reason
- `ReturnRequest` — tương tự claim + `returnCode` (`NT-R-YYYYMMDD-XXXXXX`), `reason`, `quantity`, `desiredResolution` (REFUND/EXCHANGE/STORE_CREDIT — placeholder, không gọi payment), status machine (REQUESTED→UNDER_REVIEW→APPROVED→AWAITING_RETURN→RECEIVED→COMPLETED, REJECTED/CANCELLED), `orderSyncedStatus`/`orderSyncedAt`
- `ReturnRequestMedia`, `ReturnRequestHistory`
- `WarrantyIdempotency`, `OutboxEvent`, `AuditLog`

Client: `apps/warranty-service/src/generated/prisma`. Order sync: APPROVED→`RETURN_REQUESTED`, COMPLETED→`RETURNED`, REJECTED/CANCELLED (nếu đã sync RETURN_REQUESTED)→`DELIVERED` qua `OrderClient.syncReturn` (`POST /api/v1/orders/:id/return-sync`), retry giới hạn, không distributed TX. Refund/inventory return chỉ publish event (`warranty.refund_requested`, `warranty.inventory_return_requested`) — không gọi HTTP payment/inventory.

## support — Prisma models (M12)

- `SupportTicket` — `ticketCode` unique (`NT-S-YYYYMMDD-XXXXXX`), customerId, category, priority, subject, description, status machine (OPEN→IN_PROGRESS→WAITING_CUSTOMER|RESOLVED|CLOSED; WAITING_CUSTOMER customer-message→WAITING_STAFF; RESOLVED→CLOSED|reopen), optional `orderId`/`warrantyClaimId`/`returnRequestId` (REST ID only), `assigneeId`, `version` optimistic lock
- `SupportTicketMessage` — authorId/authorType CUSTOMER|STAFF, content
- `SupportTicketAttachment` — mediaId reference, kind IMAGE, optional messageId, soft `deletedAt`; max 5 / ticket
- `SupportTicketHistory` — from/to/action/actor/reason
- `SupportIdempotency`, `OutboxEvent`, `AuditLog`

Client: `apps/support-service/src/generated/prisma`. Order link: soft ownership check qua `OrderClient.getOrder` khi có `orderId`. Không truy cập DB warranty/order.

## notification — Prisma models (M13)

- `InAppNotification` — userId, category, templateKey, title, body, linkUrl?, sourceEventId/Type, dataJson, readAt, soft `deletedAt`
- `EmailDelivery` — toEmail, userId?, templateKey, subject, bodyText, status PENDING/SENT/FAILED/SKIPPED, attempts, lastError, sourceEventId, sentAt
- `ProcessedEvent` — inbox idempotency theo `eventId` (PK)
- `NotificationIdempotency` — REST idempotency
- `AuditLog` — thao tác nhạy cảm (event processed, request notification)

Client: `apps/notification-service/src/generated/prisma`. Không outbox publisher chính; **consume** RabbitMQ + inbox. SMTP qua `SMTP_*` env (LoggingEmailSender khi thiếu SMTP ở dev).

## reporting — Prisma models (M14)

- `OrderProjection` / `PaymentProjection` / `ShipmentProjection` / `ReviewProjection` / `WarrantyClaimProjection` / `WarrantyReturnProjection` / `SupportTicketProjection` — read model 1 dòng / entity nguồn (PK = ID gốc), upsert theo event mới nhất (`lastEventType`, `lastEventId` với order), index theo `status`/`customerId`/`orderId`/`productId` phục vụ filter dashboard
- `DailyMetric` — time-series đếm sự kiện theo ngày, unique `(metricDate, domain, metricKey)`; `value` kiểu `BigInt`, tăng bằng increment nguyên tử (an toàn khi nhiều consumer song song)
- `AuditLogProjection` — audit log tổng hợp từ toàn hệ thống (`audit.recorded` events) + ghi trực tiếp qua `POST /admin/reporting/audit`; `sourceEventId` unique để dedupe khi event được publish lại
- `ProcessedEvent` — inbox idempotency theo `eventId` (PK), giống pattern notification-service M13
- `ReportingIdempotency` — REST idempotency cho `POST /admin/reporting/audit`
- `AuditLog` — nhật ký nội bộ reporting-service (event đã xử lý, request audit thủ công)

Client: `apps/reporting-service/src/generated/prisma`. Migration `20260730140000_init_reporting`. Không outbox publisher; **consume** RabbitMQ (queue `reporting-service.events`) + inbox, tương tự notification-service nhưng phục vụ dashboard/audit thay vì email/in-app.

## MinIO buckets

| Bucket                | Nội dung           |
| --------------------- | ------------------ |
| `product-media`       | Ảnh/video sản phẩm |
| `review-media`        | Đánh giá           |
| `support-attachments` | Ticket             |
| `invoices`            | PDF hóa đơn        |
| `misc`                | Khác               |

Buckets được tạo bởi service `minio-init` trong Compose.

## Migration policy

1. Mọi thay đổi schema → Prisma migration
2. Cấm agent tự chạy `prisma migrate reset` / DROP DATABASE
3. Production: migrate job trước rollout
4. Local: `npx prisma migrate deploy` trong thư mục app sau khi Compose up
