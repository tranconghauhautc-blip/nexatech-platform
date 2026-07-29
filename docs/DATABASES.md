# NexaTech Databases

## Nguyên tắc

- PostgreSQL 16
- Database (hoặc schema tách biệt) **per service**
- Prisma ORM + migration files
- Application role riêng (không dùng superuser `postgres`)
- Không foreign key cross-service; chỉ lưu ID tham chiếu

## Danh sách database

| Service | Database name | Ownership |
|---------|---------------|-----------|
| identity-service | `nexatech_identity` | users, credentials, oauth links, roles, devices, sessions metadata |
| customer-service | `nexatech_customer` | profiles, addresses, preferences |
| catalog-service | `nexatech_catalog` | categories, brands, products, variants, skus, attributes, price history |
| inventory-service | `nexatech_inventory` | warehouses, stores, stock levels, reservations, transfers |
| cart-service | `nexatech_cart` | carts, cart items, wishlists, comparisons, recently viewed |
| order-service | `nexatech_order` | orders, order items, packages/shipments refs, invoice refs |
| payment-service | `nexatech_payment` | payments, provider transactions, webhook logs |
| shipping-service | `nexatech_shipping` | shipments, tracking events, carrier quotes |
| review-service | `nexatech_review` | reviews, review media, moderation |
| warranty-service | `nexatech_warranty` | warranty policies, claims, return requests |
| notification-service | `nexatech_notification` | notification records, email outbox status |
| support-service | `nexatech_support` | tickets, messages, assignments |
| reporting-service | `nexatech_reporting` | report snapshots, audit_logs |
| media-service | `nexatech_media` | media metadata, object keys, owners |

## Redis

| Key pattern | Mục đích | TTL |
|-------------|----------|-----|
| `session:{sessionId}` | Refresh/session payload | theo policy refresh |
| `user_sessions:{userId}` | Index phiên theo user | — |
| `otp:{purpose}:{subject}` | OTP email | ngắn (phút) |
| `rate:{route}:{id}` | Rate limit | cửa sổ ngắn |
| `cart:guest:{guestId}` | (tuỳ chọn cache) | — |

## MinIO buckets

| Bucket | Nội dung |
|--------|----------|
| `product-media` | Ảnh/video sản phẩm |
| `review-media` | Ảnh/video đánh giá |
| `support-attachments` | File đính kèm ticket |
| `invoices` | PDF hóa đơn |
| `misc` | Khác |

## Schema sketch (logic)

### identity

- `User` (id, email, emailVerifiedAt, status, createdAt)
- `Credential` (userId, passwordHash)
- `OAuthAccount` (provider, providerUserId, userId)
- `Role`, `UserRole`
- `Device` / `Session` (sessionId, userId, userAgent, ipHash, expiresAt, revokedAt)

### catalog

- `Category` (tree via parentId)
- `Brand`
- `Product` (slug, categoryId, brandId, status, specs JSON)
- `ProductVariant` / `Sku` (skuCode, attributes)
- `Price` + `PriceHistory`
- `ProductMediaRef` (mediaId)

### inventory

- `Warehouse`, `Store`
- `StockItem` (skuCode, warehouseId, onHand, reserved)
- `Reservation` (orderId?, status, expiresAt)
- `StockTransfer`

### order

- `Order` (userId, status, totals, shippingAddress snapshot)
- `OrderItem` (skuCode, qty, unitPrice snapshot)
- `OrderPackage` (split fulfillment)
- `Invoice` (storageKey)

Chi tiết Prisma schema được tạo trong milestone tương ứng của từng service.

## Migration policy

1. Mọi thay đổi schema → Prisma migration
2. CI chạy migrate trên DB test
3. Production: migrate job trước khi rollout pod mới
4. Cấm `migrate reset` tự động trong agent workflow
