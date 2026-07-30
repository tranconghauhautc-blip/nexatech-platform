# NexaTech Databases

## Nguyên tắc

- PostgreSQL 16
- Database **per service**
- Prisma ORM + **migrations** (không `db push` production)
- Application role riêng (không dùng superuser `postgres` cho app)
- Không FK cross-service

## Trạng thái persistence sau M7

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
| `REDIS_URL`              | Redis              |
| `RABBITMQ_URL`           | RabbitMQ           |
| `MINIO_*`                | Object storage     |
| `CATALOG_SERVICE_URL`    | REST catalog       |
| `INVENTORY_SERVICE_URL`  | REST inventory     |
| `CART_SERVICE_URL`       | REST cart (order)  |

Init Compose (`infra/docker/postgres/init-databases.sql`):

- Users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media`, `nexatech_inventory`, `nexatech_cart`, `nexatech_order`, `nexatech_payment`, `nexatech_shipping`, `nexatech_review` (password dev `changeme`)
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
| warranty-service     | `nexatech_warranty`     | Later                                             |
| notification-service | `nexatech_notification` | Later                                             |
| support-service      | `nexatech_support`      | Later                                             |
| reporting-service    | `nexatech_reporting`    | Later                                             |

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
