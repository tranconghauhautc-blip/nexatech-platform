# NexaTech API Contracts

Tài liệu này mô tả contract REST ở mức kiến trúc. Chi tiết DTO TypeScript sống trong `libs/shared/contracts` (từ M2 trở đi).

## Quy ước chung

- Base path: `/api/v1/...` (primary), `/api/v2/...` (compat/evolution)
- Content-Type: `application/json`
- Auth: `Authorization: Bearer <accessToken>`
- Correlation: `x-request-id`, `x-trace-id`
- Phân trang: `page`, `pageSize` (mặc định 20, tối đa 100)
- Lỗi: envelope thống nhất (`errorCode`, `message`, `details`, `traceId`, `timestamp`)

## identity-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/auth/register` | Đăng ký email | Public |
| POST | `/api/v1/auth/login` | Đăng nhập | Public |
| POST | `/api/v1/auth/google` | Google OAuth | Public |
| POST | `/api/v1/auth/refresh` | Refresh token | Public (refresh) |
| POST | `/api/v1/auth/logout` | Đăng xuất phiên hiện tại | User |
| POST | `/api/v1/auth/verify-email` | Xác minh email | Public |
| POST | `/api/v1/auth/forgot-password` | Quên mật khẩu | Public |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu | Public |
| POST | `/api/v1/auth/otp/request` | Yêu cầu OTP | User/Public |
| POST | `/api/v1/auth/otp/verify` | Xác minh OTP | User/Public |
| GET | `/api/v1/sessions` | Danh sách phiên/thiết bị | User |
| DELETE | `/api/v1/sessions/:id` | Thu hồi phiên | User |
| GET | `/api/v1/users/me` | Thông tin user hiện tại | User |
| GET/PATCH | `/api/v1/admin/users...` | Quản trị user/role | Admin+ |

## customer-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET/PUT | `/api/v1/customers/me` | Hồ sơ khách | Customer |
| CRUD | `/api/v1/customers/me/addresses` | Địa chỉ giao hàng | Customer |
| GET/PUT | `/api/v1/customers/me/preferences` | Preference | Customer |

## catalog-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/v1/categories` | Cây danh mục | Public |
| GET | `/api/v1/brands` | Thương hiệu | Public |
| GET | `/api/v1/products` | Tìm kiếm/lọc sản phẩm | Public |
| GET | `/api/v1/products/:slug` | Chi tiết sản phẩm | Public |
| GET | `/api/v1/skus/:skuCode` | Chi tiết SKU | Public |
| GET | `/api/v1/products/:id/recommendations` | Gợi ý rule-based | Public |
| CRUD | `/api/v1/admin/catalog/...` | Quản trị catalog/giá | Staff+ |

## media-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/media/presign` | Presigned upload | User/Staff |
| GET | `/api/v1/media/:id` | Metadata | Depends |
| DELETE | `/api/v1/media/:id` | Xóa object | Owner/Staff |

## inventory-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/v1/inventory/availability` | Tồn khả dụng theo SKU | Public/Internal |
| POST | `/api/v1/inventory/reservations` | Giữ tồn | Internal/Order |
| POST | `/api/v1/inventory/reservations/:id/confirm` | Trừ tồn | Internal |
| POST | `/api/v1/inventory/reservations/:id/release` | Hoàn giữ | Internal |
| POST | `/api/v1/inventory/transfers` | Điều chuyển kho | Manager+ |
| CRUD | `/api/v1/admin/warehouses`, `/stores` | Kho/cửa hàng | Manager+ |

## cart-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET/PUT | `/api/v1/cart` | Giỏ hàng | Guest/User |
| POST | `/api/v1/cart/merge` | Gộp giỏ khi login | User |
| CRUD | `/api/v1/wishlist` | Wishlist | User |
| CRUD | `/api/v1/comparisons` | So sánh sản phẩm | Guest/User |
| POST/GET | `/api/v1/recently-viewed` | Đã xem | Guest/User |

## order-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/checkout` | Tạo đơn từ cart | User |
| GET | `/api/v1/orders` | Đơn của tôi | User |
| GET | `/api/v1/orders/:id` | Chi tiết đơn + kiện | User |
| GET | `/api/v1/orders/:id/invoice` | Hóa đơn PDF | User |
| PATCH | `/api/v1/admin/orders/:id/status` | Cập nhật fulfillment | Staff+ |

## payment-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/payments` | Khởi tạo thanh toán | User/Internal |
| GET | `/api/v1/payments/:id` | Trạng thái | User |
| POST | `/api/v1/payments/vnpay/ipn` | VNPay IPN | Public (signed) |
| POST | `/api/v1/payments/mock/complete` | Hoàn tất mock | Dev/Test |

Methods: `COD`, `MOCK`, `VNPAY_SANDBOX`.

## shipping-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/shipments` | Tạo vận đơn | Internal/Staff |
| GET | `/api/v1/shipments/:id` | Chi tiết | User/Staff |
| GET | `/api/v1/shipments/:id/tracking` | Tracking | User/Staff |
| POST | `/api/v1/shipping/quote` | Báo phí (mock/real) | User |

## review-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/v1/products/:productId/reviews` | Danh sách đánh giá | Public |
| POST | `/api/v1/reviews` | Tạo đánh giá (đã mua) | User |
| POST | `/api/v1/reviews/:id/media` | Gắn ảnh/video | User |
| PATCH | `/api/v1/admin/reviews/:id/moderation` | Kiểm duyệt | Staff+ |

## warranty-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/warranties/claims` | Yêu cầu BH/đổi trả | User |
| GET | `/api/v1/warranties/claims` | Danh sách của tôi | User |
| PATCH | `/api/v1/admin/warranties/claims/:id` | Xử lý | Staff+ |

## support-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/v1/support/tickets` | Tạo ticket | User |
| GET | `/api/v1/support/tickets` | Ticket của tôi | User |
| POST | `/api/v1/support/tickets/:id/messages` | Nhắn trong ticket | User/Staff |
| PATCH | `/api/v1/admin/support/tickets/:id` | Đổi trạng thái | Staff+ |

## notification-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/v1/notifications` | In-app | User |
| POST | `/api/v1/notifications/:id/read` | Đánh dấu đã đọc | User |
| POST | `/api/v1/admin/notifications/email/test` | Test email | Admin |

## reporting-service

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/v1/admin/reports/overview` | Dashboard | Manager+ |
| GET | `/api/v1/admin/reports/sales` | Doanh số | Manager+ |
| GET | `/api/v1/admin/audit-logs` | Audit log | Admin+ |

## Health endpoints (mọi service)

| Path | Mục đích |
|------|----------|
| `/health` | Liveness đơn giản |
| `/health/live` | Liveness |
| `/health/ready` | Readiness (DB/Redis/MQ) |

## Ghi chú v2

`/api/v2` được đăng ký song song từ đầu (Nest versioning). Ban đầu mirror hành vi v1 hoặc trả `501` có kiểm soát cho endpoint chưa migrate — tránh phá gateway routing.
