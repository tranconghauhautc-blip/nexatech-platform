# NexaTech OWASP API Security Scenarios

> **Trạng thái:** Skeleton thiết kế — triển khai đầy đủ 20 kịch bản ở **M21**, sau khi business logic ổn định.
> Không làm gián đoạn luồng sử dụng bình thường của website.

## Phạm vi

OWASP API Security Top 10 áp dụng cho REST qua Kong:

1. Broken Object Level Authorization (BOLA)
2. Broken Authentication
3. Broken Object Property Level Authorization
4. Unrestricted Resource Consumption
5. Broken Function Level Authorization
6. Unrestricted Access to Sensitive Business Flows
7. Server Side Request Forgery
8. Security Misconfiguration
9. Improper Inventory Management
10. Unsafe Consumption of APIs

## Kịch bản dự kiến (20)

| # | OWASP | Tên kịch bản | Endpoint (dự kiến) | Vai trò | Kết quả mong đợi |
|---|-------|--------------|--------------------|---------|------------------|
| 1 | API1 | Truy cập đơn của user khác | `GET /api/v1/orders/:id` | Customer | 403/404 |
| 2 | API1 | Đổi địa chỉ customer khác | `PUT /api/v1/customers/:id` | Customer | 403 |
| 3 | API2 | Refresh token đã revoke | `POST /api/v1/auth/refresh` | Public | 401 |
| 4 | API2 | Brute-force login bị chặn | `POST /api/v1/auth/login` | Public | 429 |
| 5 | API2 | JWT hết hạn | Protected routes | User | 401 |
| 6 | API3 | Mass assignment role | `PATCH /api/v1/users/me` | Customer | role không đổi |
| 7 | API3 | Ẩn field nhạy cảm response | `GET /api/v1/users/me` | Customer | không lộ hash |
| 8 | API4 | Page size quá lớn | `GET /api/v1/products` | Public | bị clamp/400 |
| 9 | API4 | Upload media quá dung lượng | `POST /api/v1/media/presign` | User | 400 |
| 10 | API5 | Customer gọi admin report | `GET /api/v1/admin/reports/overview` | Customer | 403 |
| 11 | API5 | Staff không elevate SuperAdmin | Admin users API | Staff | 403 |
| 12 | API6 | Spam tạo đơn hàng | `POST /api/v1/checkout` | User | rate limit |
| 13 | API6 | Review không phải người mua | `POST /api/v1/reviews` | User | 403 |
| 14 | API7 | SSRF qua URL media | `POST /api/v1/media/...` | User | reject URL nội bộ |
| 15 | API8 | Security headers / swagger prod | Gateway | — | cấu hình an toàn |
| 16 | API8 | Không lộ stack trace | any 500 | — | envelope chuẩn |
| 17 | API9 | Gọi endpoint deprecated undocumented | `/api/v2/...` lạ | — | 404 có kiểm soát |
| 18 | API9 | Inventory internal-only exposed | reserve API | Public | 401/403 |
| 19 | API10 | Webhook VNPay chữ ký sai | `POST /api/v1/payments/vnpay/ipn` | Public | 401 |
| 20 | API10 | Shipping provider response độc hại | adapter | Internal | validate/sanitize |

## Template ghi chép (M21 sẽ điền đủ)

Mỗi kịch bản cần:

- Endpoint
- Vai trò
- Điều kiện tiên quyết
- Bước kiểm thử
- Kết quả mong đợi
- Cách tự động hóa (unit/API/E2E)

## Nguyên tắc triển khai bảo mật

- Bảo vệ mặc định trong code (guards, pipes, validation)
- OWASP docs/tests bổ sung, không phá UX mua hàng bình thường
- Credential và secret không bao giờ hard-code
