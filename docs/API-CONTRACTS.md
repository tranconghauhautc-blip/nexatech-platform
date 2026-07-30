# NexaTech API Contracts

Tài liệu phản ánh **code hiện tại (sau M4)** và kế hoạch các service chưa implement.

DTO TypeScript sống trong `libs/shared/contracts`. Error envelope: `libs/shared/errors`.

## Quy ước chung (đã áp dụng)

- Global prefix: `api`
- Versioning URI: `/api/v1/...`, `/api/v2/...` (controller `version: ['1','2']`)
- Content-Type: `application/json`
- Correlation (shared): `x-request-id`, `x-trace-id`
- Phân trang helpers: `page`, `pageSize` (default 20, max 100) trong contracts
- Lỗi mục tiêu: `errorCode`, `message`, `details`, `traceId`, `timestamp` (`AppError` / `createErrorEnvelope`)
- Health (không nằm dưới `/api`): `/health`, `/health/live`, `/health/ready`
- Swagger UI: `/docs`

---

## identity-service — **đã implement (M3)**

Port mặc định: `3001` (`IDENTITY_PORT`).

| Method | Path                               | Mô tả                               | Auth hiện tại |
| ------ | ---------------------------------- | ----------------------------------- | ------------- |
| POST   | `/api/v1/auth/register`            | Đăng ký email/password/fullName     | Public        |
| POST   | `/api/v1/auth/login`               | Đăng nhập → access + refresh JWT    | Public        |
| POST   | `/api/v1/auth/verify-email`        | Body `{ email, code }` OTP          | Public        |
| POST   | `/api/v1/auth/refresh`             | Body `{ refreshToken }`             | Public        |
| POST   | `/api/v1/auth/logout`              | Body `{ sessionId }`                | Public\*      |
| POST   | `/api/v1/auth/forgot-password`     | Body `{ email }`                    | Public        |
| POST   | `/api/v1/auth/reset-password`      | Body `{ email, code, newPassword }` | Public        |
| GET    | `/api/v1/auth/sessions/:userId`    | Liệt kê phiên active                | Public\*      |
| DELETE | `/api/v1/auth/sessions/:sessionId` | Thu hồi phiên                       | Public\*      |
| GET    | `/health`                          | Health aggregate                    | Public        |
| GET    | `/health/live`                     | Liveness                            | Public        |
| GET    | `/health/ready`                    | Readiness                           | Public        |

\* Chưa gắn JWT guard — phải bổ sung trước production.

### Chưa implement (kế hoạch)

| Method            | Path                       | Ghi chú                          |
| ----------------- | -------------------------- | -------------------------------- |
| POST              | `/api/v1/auth/google`      | Chờ Google OAuth credentials     |
| POST              | `/api/v1/auth/otp/request` | OTP đang gắn vào register/forgot |
| GET               | `/api/v1/users/me`         |                                  |
| Admin users/roles | `/api/v1/admin/users...`   |                                  |

### Register body (Zod `registerRequestSchema`)

```json
{ "email": "user@nexatech.vn", "password": "Secret123", "fullName": "Nguyễn Văn A" }
```

### Login response shape

```json
{
  "userId": "uuid",
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

Access claims: `sub`, `email`, `roles`, `sessionId`, `typ: "access"`.  
Refresh claims: `sub`, `sid`, `typ: "refresh"`.

Non-production register/forgot có thể trả `debugOtp` (6 số) để test.

Cùng routes mirror trên `/api/v2/auth/...`.

---

## customer-service — **đã implement (M3)**

Port mặc định: `3002` (`CUSTOMER_PORT`).

Identity tạm thời qua headers:

- `x-user-id` (bắt buộc cho các route `me`)
- `x-user-name` (optional, default tên tiếng Việt)

| Method | Path                                       | Mô tả                         | Auth hiện tại      |
| ------ | ------------------------------------------ | ----------------------------- | ------------------ |
| GET    | `/api/v1/customers/me`                     | Get-or-create profile         | Header `x-user-id` |
| PUT    | `/api/v1/customers/me`                     | Cập nhật `fullName` / `phone` | Header             |
| GET    | `/api/v1/customers/me/addresses`           | Danh sách địa chỉ             | Header             |
| POST   | `/api/v1/customers/me/addresses`           | Thêm địa chỉ                  | Header             |
| GET    | `/health`, `/health/live`, `/health/ready` | Health                        | Public             |

### Chưa implement

- PUT/DELETE address theo id
- Preferences GET/PUT
- JWT Bearer thay header

---

## catalog-service — **đã implement (M4)**

Port mặc định: `3003` (`CATALOG_PORT`). Persistence: Prisma + `CATALOG_DATABASE_URL`.

Admin headers tạm: `x-user-roles` (ví dụ `Staff` hoặc `Manager,Admin`).

### Public

| Method | Path                                   | Mô tả                            | Auth   |
| ------ | -------------------------------------- | -------------------------------- | ------ |
| GET    | `/api/v1/categories`                   | Cây danh mục cha/con             | Public |
| GET    | `/api/v1/brands`                       | Thương hiệu                      | Public |
| GET    | `/api/v1/products`                     | Search/filter/sort/pagination    | Public |
| GET    | `/api/v1/products/:slug`               | Chi tiết sản phẩm                | Public |
| GET    | `/api/v1/skus/:skuCode`                | SKU + giá hiện tại               | Public |
| GET    | `/api/v1/products/:id/recommendations` | Rule-based (cùng brand/category) | Public |

Query `GET /products`: `q`, `categorySlug`, `brandSlug`, `status`, `minPrice`, `maxPrice`, `attributeKey`, `attributeValue`, `sort` (`relevance`\|`price_asc`\|`price_desc`\|`newest`\|`name`), `page`, `pageSize`.

### Admin (Staff+)

| Method | Path                                             | Mô tả                |
| ------ | ------------------------------------------------ | -------------------- |
| POST   | `/api/v1/admin/catalog/categories`               | Tạo danh mục         |
| PATCH  | `/api/v1/admin/catalog/categories/:id`           | Cập nhật danh mục    |
| POST   | `/api/v1/admin/catalog/brands`                   | Tạo thương hiệu      |
| PATCH  | `/api/v1/admin/catalog/brands/:id`               | Cập nhật thương hiệu |
| POST   | `/api/v1/admin/catalog/spec-templates`           | Template thông số    |
| POST   | `/api/v1/admin/catalog/products`                 | Tạo sản phẩm         |
| PATCH  | `/api/v1/admin/catalog/products/:id/status`      | Đổi trạng thái       |
| POST   | `/api/v1/admin/catalog/skus`                     | Tạo SKU + giá        |
| PATCH  | `/api/v1/admin/catalog/skus/:skuCode/price`      | Đổi giá + lịch sử    |
| POST   | `/api/v1/admin/catalog/products/:id/media-links` | Liên kết media       |

Category slugs scope: `dien-thoai`, `laptop`, `tablet`, `dong-ho-thong-minh`, `tai-nghe-loa`, `phu-kien`.

---

## media-service — **đã implement (M4)**

Port mặc định: `3004` (`MEDIA_PORT`). Persistence: Prisma + MinIO.

Headers: `x-user-id`, `x-user-roles`.

| Method | Path                                            | Mô tả                    | Auth                      |
| ------ | ----------------------------------------------- | ------------------------ | ------------------------- |
| POST   | `/api/v1/media/presign`                         | Presigned upload URL     | User                      |
| POST   | `/api/v1/media/:id/confirm`                     | Xác nhận upload → active | Owner/Staff               |
| GET    | `/api/v1/media/:id`                             | Metadata                 | Depends                   |
| GET    | `/api/v1/media/:id/download-url`                | Presigned download       | Owner/Staff/public active |
| DELETE | `/api/v1/media/:id`                             | Soft delete + xóa object | Owner/Staff               |
| POST   | `/api/v1/media/:id/links`                       | Link product/sku/review  | Staff+                    |
| GET    | `/api/v1/media/by-entity/:entityType/:entityId` | Gallery theo entity      | Public                    |
| POST   | `/api/v1/media/admin/cleanup-orphans`           | Dọn orphan pending       | Manager+                  |

Presign body: `fileName`, `contentType` (allowlist MIME), `sizeBytes` (max 20MB mặc định), `ownerType`, `ownerId`, `role`, `bucket?`.

---

## inventory-service — **đã implement (M5)**

Port mặc định: `3005` (`INVENTORY_PORT`). Persistence: Prisma + `INVENTORY_DATABASE_URL` (InMemory chỉ `NODE_ENV=test`).

Headers: `x-user-id`, `x-user-roles` (Staff+ cho mọi mutation; đọc tồn/khả dụng là public).

### Public

| Method | Path                         | Mô tả                                                 | Auth   |
| ------ | ---------------------------- | ----------------------------------------------------- | ------ |
| GET    | `/api/v1/warehouses`         | Danh sách kho                                         | Public |
| GET    | `/api/v1/stores`             | Danh sách cửa hàng                                    | Public |
| GET    | `/api/v1/stock`              | Tồn theo `skuCode`/`locationType`/`locationId`        | Public |
| GET    | `/api/v1/stock/availability` | Vị trí có đủ khả dụng (`skuCode`,`quantity`,`city?`)  | Public |
| GET    | `/api/v1/stock/sources`      | Vị trí nguồn tốt nhất cho `skuCode`/`quantity`        | Public |
| GET    | `/api/v1/stock/low`          | Danh sách tồn thấp (`available <= lowStockThreshold`) | Public |
| GET    | `/api/v1/movements`          | Nhật ký dịch chuyển tồn (phân trang)                  | Public |
| GET    | `/api/v1/reservations/:id`   | Chi tiết yêu cầu giữ hàng                             | Public |

### Admin (Staff+)

| Method | Path                                               | Mô tả                                                         |
| ------ | -------------------------------------------------- | ------------------------------------------------------------- |
| POST   | `/api/v1/admin/inventory/warehouses`               | Tạo kho                                                       |
| POST   | `/api/v1/admin/inventory/stores`                   | Tạo cửa hàng                                                  |
| POST   | `/api/v1/admin/inventory/stock/receive`            | Nhập kho (idempotent theo `idempotencyKey`)                   |
| POST   | `/api/v1/admin/inventory/stock/issue`              | Xuất kho (idempotent)                                         |
| POST   | `/api/v1/admin/inventory/stock/reserve`            | Giữ hàng nhiều dòng, tự chọn vị trí nguồn                     |
| POST   | `/api/v1/admin/inventory/stock/adjust`             | Kiểm kê — set `onHand` (không thấp hơn `reserved`)            |
| POST   | `/api/v1/admin/inventory/stock/return`             | Hoàn tồn theo `reservationId` hoặc danh sách dòng             |
| POST   | `/api/v1/admin/inventory/reservations/:id/release` | Hủy giữ hàng                                                  |
| POST   | `/api/v1/admin/inventory/reservations/:id/commit`  | Xác nhận xuất theo giữ hàng (trừ onHand+reserved)             |
| POST   | `/api/v1/admin/inventory/transfers`                | Điều chuyển giữa hai vị trí (PENDING→COMPLETED trong 1 luồng) |

Idempotency: `receive`/`issue`/`reserve`/`adjust`/`transfer` yêu cầu `idempotencyKey` (≥8 ký tự) — gọi lại cùng key trả nguyên response đã lưu (`IdempotencyRecord`), khác `operation` sẽ trả lỗi `INVENTORY_IDEMPOTENCY_CONFLICT`.

Optimistic locking: mỗi thay đổi `StockItem` tăng `version`; xung đột phiên bản sau 3 lần thử trả `INVENTORY_CONFLICT`. Không cho phép `reserved > onHand` hoặc âm — trả `INVENTORY_INSUFFICIENT`.

---

## cart-service — **đã implement (M6)**

Port mặc định: `3006` (`CART_PORT`). Persistence: Prisma + `CART_DATABASE_URL`; Redis (`REDIS_URL`) cho idempotency/lock/guest TTL; InMemory chỉ unit/`NODE_ENV=test`.

Headers:

- `x-user-id` — customer đã đăng nhập (không tin customerId từ body)
- `x-cart-token` — guest cart token (trả về khi `POST /carts/guest`)

Env tích hợp: `CATALOG_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `RABBITMQ_URL`.

| Method          | Path                                 | Mô tả                                               | Auth       |
| --------------- | ------------------------------------ | --------------------------------------------------- | ---------- |
| POST            | `/api/v1/carts/guest`                | Tạo guest cart + token                              | Public     |
| GET             | `/api/v1/carts/current`              | Lấy giỏ hiện tại (guest token hoặc user)            | Guest/User |
| POST            | `/api/v1/carts/current/items`        | Thêm SKU (`skuCode`, `quantity`, `idempotencyKey?`) | Guest/User |
| PATCH           | `/api/v1/carts/current/items/:skuId` | Cập nhật số lượng                                   | Guest/User |
| DELETE          | `/api/v1/carts/current/items/:skuId` | Xóa một dòng                                        | Guest/User |
| DELETE          | `/api/v1/carts/current`              | Xóa toàn bộ dòng                                    | Guest/User |
| POST            | `/api/v1/carts/merge`                | Gộp guest → customer (`guestCartToken`)             | User       |
| POST            | `/api/v1/carts/current/refresh`      | Refresh giá/metadata từ catalog                     | Guest/User |
| POST            | `/api/v1/carts/current/validate`     | Validate + issues + `reservationPreview`            | Guest/User |
| POST            | `/api/v1/carts/convert`              | ACTIVE → CONVERTED + tạo giỏ ACTIVE mới (checkout)  | User       |
| GET/POST/DELETE | `/api/v1/wishlist...`                | Wishlist theo customer                              | User       |
| GET/POST/DELETE | `/api/v1/comparison...`              | So sánh tối đa 4 sản phẩm                           | User       |
| GET/POST        | `/api/v1/recently-viewed`            | Sản phẩm đã xem                                     | Guest/User |

Giới hạn: tối đa **99** mỗi dòng; snapshot giá chỉ hiển thị; add-to-cart soft-check inventory, chưa reserve.

---

## order-service — **đã implement (M7)**

Port mặc định: `3007` (`ORDER_PORT`). Persistence: Prisma + `ORDER_DATABASE_URL`; outbox → RabbitMQ khi có `RABBITMQ_URL`; InMemory chỉ unit/`NODE_ENV=test`.

Headers:

- `x-user-id` — customer / actor (không tin customerId từ body)
- `x-user-roles` — comma-separated roles (Staff+ cho admin)

Env tích hợp: `CART_SERVICE_URL`, `CATALOG_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `CUSTOMER_SERVICE_URL`, `PAYMENT_SERVICE_URL`, `SHIPPING_SERVICE_URL` (contract), `RABBITMQ_URL`.

### Customer

| Method | Path                                         | Mô tả                                                            |
| ------ | -------------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/v1/orders`                             | Tạo đơn từ cart (idempotencyKey bắt buộc; re-price + reserve)    |
| GET    | `/api/v1/orders`                             | Danh sách đơn của customer (filter/sort/pagination)              |
| GET    | `/api/v1/orders/:orderId`                    | Chi tiết đơn (ownership)                                         |
| POST   | `/api/v1/orders/:orderId/cancel`             | Hủy khi trạng thái cho phép                                      |
| POST   | `/api/v1/orders/:orderId/confirm`            | Xác nhận (AWAITING_PAYMENT → CONFIRMED)                          |
| POST   | `/api/v1/orders/:orderId/payment-sync`       | Đồng bộ paymentStatus từ payment-service (Staff+)                |
| POST   | `/api/v1/orders/:orderId/return-sync`        | Đồng bộ RETURN_REQUESTED/RETURNED/DELIVERED từ warranty (Staff+) |
| POST   | `/api/v1/orders/:orderId/status-transitions` | Transition (staff qua admin; customer hạn chế)                   |
| GET    | `/api/v1/orders/:orderId/status-history`     | Lịch sử trạng thái                                               |
| GET    | `/api/v1/orders/:orderId/packages`           | Danh sách kiện                                                   |

### Admin / Staff

| Method | Path                                               | Mô tả                                    |
| ------ | -------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/v1/admin/orders`                             | Tìm kiếm đơn (status/date/customer/code) |
| GET    | `/api/v1/admin/orders/:orderId`                    | Chi tiết                                 |
| POST   | `/api/v1/admin/orders/:orderId/status-transitions` | Transition hợp lệ + audit + event        |
| POST   | `/api/v1/admin/orders/:orderId/cancel`             | Hủy (quyền rộng hơn customer)            |
| POST   | `/api/v1/admin/orders/:orderId/confirm`            | Confirm thanh toán mock/staff            |

Create order body chỉ nhận: `idempotencyKey`, `deliveryMethod`, `paymentMethod`, address/pickup/slot, customer display snapshot optional — **không** nhận giá, SKU list, customerId, totals.

Money: integer VND; `discountTotal` luôn `0`.

`payment-sync` body: `paymentStatus`, `paymentReference?`, `paidAt?`, `confirmOrder?`, `idempotencyKey?`. Khi `confirmOrder=true` + `PAID` và order đang `AWAITING_PAYMENT` → chuyển `CONFIRMED`.

`return-sync` body: `toStatus` (`RETURN_REQUESTED` \| `RETURNED` \| `DELIVERED`), `returnRequestId?`, `orderItemId?`, `reason?`, `idempotencyKey?`. Idempotent nếu order đã ở `toStatus`; chỉ cho phép transition hợp lệ của order state machine.

---

## payment-service — **đã implement (M8)**

Port mặc định: `3008` (`PAYMENT_PORT`). Persistence: Prisma + `PAYMENT_DATABASE_URL`; outbox → RabbitMQ khi có `RABBITMQ_URL`; InMemory chỉ unit/`NODE_ENV=test`.

Headers:

- `x-user-id` — customer / actor (không tin customerId từ body)
- `x-user-roles` — comma-separated roles (Staff+ cho admin)

Env: `ORDER_SERVICE_URL`, `RABBITMQ_URL`, `REDIS_URL` (optional), `PAYMENT_PUBLIC_BASE_URL`, `PAYMENT_RETURN_URL`, `PAYMENT_IPN_URL`, `MOCK_PAYMENT_ENABLED`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`.

### Customer

| Method | Path                                  | Mô tả                                                            |
| ------ | ------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/v1/payments`                    | Tạo payment intent từ order (amount lấy từ order, không từ body) |
| GET    | `/api/v1/payments/:paymentId`         | Chi tiết (ownership)                                             |
| GET    | `/api/v1/payments/order/:orderId`     | Payment theo order                                               |
| POST   | `/api/v1/payments/:paymentId/cancel`  | Huỷ payment đang active                                          |
| POST   | `/api/v1/payments/:paymentId/refunds` | Yêu cầu refund (full/partial)                                    |
| GET    | `/api/v1/payments/:paymentId/refunds` | Danh sách refund                                                 |

### Mock (chỉ khi `MOCK_PAYMENT_ENABLED` cho phép)

| Method | Path                                       | Mô tả                 |
| ------ | ------------------------------------------ | --------------------- |
| POST   | `/api/v1/payments/mock/:paymentId/succeed` | Giả lập thanh toán OK |
| POST   | `/api/v1/payments/mock/:paymentId/fail`    | Giả lập thất bại      |
| POST   | `/api/v1/payments/mock/:paymentId/cancel`  | Giả lập huỷ           |

### VNPay Sandbox

| Method   | Path                            | Mô tả                                 |
| -------- | ------------------------------- | ------------------------------------- |
| GET/POST | `/api/v1/payments/vnpay/return` | Return URL sau khi khách thanh toán   |
| GET/POST | `/api/v1/payments/vnpay/ipn`    | IPN callback — verify chữ ký + amount |

IPN response: `{ "RspCode": "00", "Message": "Confirm Success" }` (hoặc mã lỗi theo contract VNPay).

### Admin / Staff

| Method | Path                                        | Mô tả                       |
| ------ | ------------------------------------------- | --------------------------- |
| GET    | `/api/v1/admin/payments`                    | List filter/sort/pagination |
| GET    | `/api/v1/admin/payments/:paymentId`         | Chi tiết                    |
| POST   | `/api/v1/admin/payments/:paymentId/refunds` | Refund (staff)              |

Create payment body: `orderId`, `idempotencyKey`, `method?`, `returnUrl?` — **không** nhận amount/customerId.

### VNPay Sandbox cấu hình

1. Đăng ký merchant sandbox tại VNPay, lấy `vnp_TmnCode` và `vnp_HashSecret`.
2. Set `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` (sandbox URL).
3. `VNPAY_RETURN_URL` / `VNPAY_IPN_URL` trỏ về payment-service (public URL khi test thật).
4. **Amount:** `vnp_Amount = grandTotalVND * 100` (VNPay không có phần thập phân VND nhưng vẫn ×100 theo contract).
5. Chữ ký HMAC-SHA512 trên query đã sort; không tin callback nếu chữ ký sai; không log secret.
6. Local không có credential: dùng MOCK (`MOCK_PAYMENT_ENABLED=true`).

### Mock local

```powershell
$env:MOCK_PAYMENT_ENABLED='true'
$env:NODE_ENV='development'
# POST /api/v1/payments { orderId, idempotencyKey, method: "MOCK" }
# POST /api/v1/payments/mock/:paymentId/succeed
```

---

## shipping-service (M9)

Base: `/api/v1` (mirror `/api/v2`). Port **3009**. Auth tạm: `x-user-id` / `x-user-roles`. Webhook: không JWT — verify `x-shipping-signature` / `x-webhook-token`.

### Quotes / slots / shipments

| Method | Path                                              | Mô tả                                               |
| ------ | ------------------------------------------------- | --------------------------------------------------- |
| POST   | `/api/v1/shipping/quotes`                         | Tạo báo giá từ order packages                       |
| GET    | `/api/v1/shipping/slots`                          | List slot còn chỗ                                   |
| POST   | `/api/v1/shipping/slots/reserve`                  | Reserve slot (idempotent)                           |
| POST   | `/api/v1/shipping/shipments`                      | Tạo shipment / package                              |
| GET    | `/api/v1/shipping/shipments/:id`                  | Chi tiết (ownership)                                |
| GET    | `/api/v1/shipping/shipments/by-order/:orderId`    | List theo đơn                                       |
| POST   | `/api/v1/shipping/shipments/:id/book`             | Book (staff+) — cần package ALLOCATED/READY_TO_SHIP |
| POST   | `/api/v1/shipping/shipments/:id/status`           | Transition trạng thái (staff+)                      |
| POST   | `/api/v1/shipping/shipments/:id/cancel`           | Huỷ                                                 |
| POST   | `/api/v1/shipping/shipments/:id/ready-for-pickup` | STORE_PICKUP — sinh mã nhận                         |
| POST   | `/api/v1/shipping/shipments/:id/confirm-pickup`   | Xác nhận mã → DELIVERED                             |
| GET    | `/api/v1/shipping/tracking/:trackingCode`         | Public tracking (field giới hạn)                    |
| POST   | `/api/v1/shipping/webhooks/:provider`             | Provider webhook (MOCK/GHN)                         |

### Admin

| Method | Path                               | Mô tả                       |
| ------ | ---------------------------------- | --------------------------- |
| GET    | `/api/v1/admin/shipping/shipments` | List filter/sort/pagination |

### Order sync

| Method | Path                                    | Mô tả                                                                            |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| POST   | `/api/v1/orders/:orderId/shipping-sync` | Staff+ — cập nhật package tracking/status; order → SHIPPED/DELIVERED khi đủ kiện |

Body shipping-sync: `packageId`, `shipmentId`, `trackingCode?`, `shippingProvider?`, `packageStatus?`, `estimatedDeliveryAt?`, `orderStatus?`, `idempotencyKey?`.

Create quote body: `orderId`, `idempotencyKey`, `deliveryMethod?`, `packageIds?` — **không** nhận fee từ client.

### Mock / GHN

- `SHIPPING_PROVIDER=MOCK` (mặc định) + `MOCK_SHIPPING_ENABLED=true` non-prod.
- GHN: skeleton — cần `GHN_TOKEN`, `GHN_SHOP_ID`, `GHN_BASE_URL`; thiếu thì `SHIPPING_PROVIDER_DISABLED` / fallback rule-based fee.

---

## review-service (M10) — port 3010

Auth tạm: `x-user-id`, `x-user-roles`. CustomerId luôn lấy từ header, không từ body.

### Customer / public

| Method | Path                                          | Mô tả                             | Auth              |
| ------ | --------------------------------------------- | --------------------------------- | ----------------- |
| POST   | `/api/v1/reviews`                             | Tạo review (verified buyer)       | Customer          |
| GET    | `/api/v1/reviews/:reviewId`                   | Chi tiết (public chỉ PUBLISHED)   | Optional          |
| PATCH  | `/api/v1/reviews/:reviewId`                   | Sửa (owner, ≤72h)                 | Customer          |
| DELETE | `/api/v1/reviews/:reviewId`                   | Soft-delete                       | Owner hoặc Staff+ |
| GET    | `/api/v1/products/:productId/reviews`         | List PUBLISHED + filter/sort/page | Public            |
| GET    | `/api/v1/products/:productId/reviews/summary` | Aggregate rating                  | Public            |
| POST   | `/api/v1/reviews/:reviewId/helpful`           | Vote hữu ích                      | Customer          |
| DELETE | `/api/v1/reviews/:reviewId/helpful`           | Bỏ vote                           | Customer          |
| POST   | `/api/v1/reviews/:reviewId/reports`           | Báo cáo                           | Customer          |
| POST   | `/api/v1/reviews/:reviewId/media`             | Gắn media reference               | Owner             |
| DELETE | `/api/v1/reviews/:reviewId/media/:mediaId`    | Unlink media                      | Owner/Staff       |
| POST   | `/api/v1/reviews/:reviewId/replies`           | Store reply                       | Staff+            |
| PATCH  | `/api/v1/reviews/:reviewId/replies/:replyId`  | Sửa reply                         | Staff+            |
| DELETE | `/api/v1/reviews/:reviewId/replies/:replyId`  | Soft-delete reply                 | Staff+            |

Create body: `orderId`, `orderItemId`, `rating` (1–5), `content` (min 10), `title?`, `mediaIds?`, `displayName?`, `idempotencyKey?`.

List query: `rating`, `hasMedia`, `verifiedOnly`, `sort=newest|highest|lowest|most_helpful`, pagination.

### Admin

| Method | Path                                             | Mô tả                                                | Auth   |
| ------ | ------------------------------------------------ | ---------------------------------------------------- | ------ |
| GET    | `/api/v1/admin/reviews`                          | Queue / filter status/reported/product/customer/date | Staff+ |
| GET    | `/api/v1/admin/reviews/:reviewId`                | Chi tiết + moderation history                        | Staff+ |
| POST   | `/api/v1/admin/reviews/:reviewId/moderate`       | publish/hide/reject/restore + reason                 | Staff+ |
| GET    | `/api/v1/admin/review-reports`                   | Danh sách report                                     | Staff+ |
| POST   | `/api/v1/admin/review-reports/:reportId/resolve` | RESOLVED/DISMISSED (+ hideReview?)                   | Staff+ |
| POST   | `/api/v1/admin/reviews/aggregates/rebuild`       | Rebuild aggregate (productId?)                       | Staff+ |

### Verified buyer / privacy

- Order phải `DELIVERED` và thuộc customer; item tồn tại; package chứa item (nếu có) cũng `DELIVERED`.
- Public response: không email/phone/customerId; `displayName` đã mask.

---

## warranty-service (M11) — port 3011

Auth tạm: `x-user-id`, `x-user-roles`. CustomerId/ownership/eligibility luôn xác định từ header + `OrderClient`, không tin body.

### Customer

| Method | Path                                      | Mô tả                                           | Auth     |
| ------ | ----------------------------------------- | ----------------------------------------------- | -------- |
| POST   | `/api/v1/warranty/claims`                 | Tạo yêu cầu bảo hành (verified buyer)           | Customer |
| GET    | `/api/v1/warranty/claims`                 | List của tôi + filter/pagination                | Customer |
| GET    | `/api/v1/warranty/claims/:claimId`        | Chi tiết (owner hoặc Staff+)                    | Customer |
| POST   | `/api/v1/warranty/claims/:claimId/media`  | Gắn media reference (ownership + MIME image/\*) | Owner    |
| POST   | `/api/v1/warranty/claims/:claimId/cancel` | Hủy yêu cầu (rotate activeKey)                  | Owner    |
| POST   | `/api/v1/returns`                         | Tạo yêu cầu đổi trả (verified buyer)            | Customer |
| GET    | `/api/v1/returns`                         | List của tôi + filter/pagination                | Customer |
| GET    | `/api/v1/returns/:returnId`               | Chi tiết (owner hoặc Staff+)                    | Customer |
| POST   | `/api/v1/returns/:returnId/media`         | Gắn media reference                             | Owner    |
| POST   | `/api/v1/returns/:returnId/cancel`        | Hủy yêu cầu (rotate activeKey)                  | Owner    |

Create claim body: `orderId`, `orderItemId`, `issueType` (DEFECT/MALFUNCTION/MISSING_PARTS/OTHER), `description` (10–5000 ký tự), `serialNumber?`, `mediaIds?` (≤5 ảnh), `idempotencyKey?`.

Create return body: `orderId`, `orderItemId`, `reason` (DEFECTIVE/WRONG_ITEM/CHANGED_MIND/DAMAGED_SHIPPING/OTHER), `description`, `quantity?` (≤ số lượng đã mua), `desiredResolution?` (REFUND/EXCHANGE/STORE_CREDIT, mặc định REFUND — không kích hoạt payment/inventory), `mediaIds?`, `idempotencyKey?`.

### Admin

| Method | Path                                                | Mô tả                                                                          | Auth   |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| GET    | `/api/v1/admin/warranty/claims`                     | Queue + filter status/customer/order/date                                      | Staff+ |
| GET    | `/api/v1/admin/warranty/claims/:claimId`            | Chi tiết + history                                                             | Staff+ |
| POST   | `/api/v1/admin/warranty/claims/:claimId/transition` | start_review/approve/reject/start_repair/complete/cancel                       | Staff+ |
| GET    | `/api/v1/admin/returns`                             | Queue + filter                                                                 | Staff+ |
| GET    | `/api/v1/admin/returns/:returnId`                   | Chi tiết + history                                                             | Staff+ |
| POST   | `/api/v1/admin/returns/:returnId/transition`        | start_review/approve/reject/mark_awaiting_return/mark_received/complete/cancel | Staff+ |

Transition body: `action`, `reason?`, `expectedVersion?` (optimistic lock), `idempotencyKey?`.

### Verified buyer / domain rules

- Order phải `DELIVERED` và thuộc customer (header); `orderItemId` tồn tại trong order; package chứa item (nếu có) cũng `DELIVERED`.
- SKU/productId lấy từ order item snapshot, không từ body.
- Một active claim và một active return / `(customerId, orderItemId)` (`activeKey`); soft cancel rotate key để cho phép yêu cầu mới.
- Return APPROVED/COMPLETED/REJECTED (sau khi đã sync)/CANCELLED (sau khi đã sync) đồng bộ trạng thái sang order-service qua `OrderClient.syncReturn`; không distributed TX.
- `mark_received` chỉ publish `warranty.inventory_return_requested`; `complete` với `desiredResolution=REFUND` chỉ publish `warranty.refund_requested` — **không** gọi HTTP payment/inventory trực tiếp.

---

## Các service sau M11 (kế hoạch — chưa code)

Support, notification, reporting. Chi tiết endpoint xem ARCHITECTURE khi triển khai milestone tương ứng.

## Ghi chú v2

`/api/v2` đăng ký song song; hành vi hiện mirror v1.
