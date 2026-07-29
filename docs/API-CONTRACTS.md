# NexaTech API Contracts

Tài liệu phản ánh **code hiện tại (sau M3)** và kế hoạch các service chưa implement.

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

## catalog-service — **kế hoạch M4 (chưa có code)**

| Method | Path                                   | Mô tả        | Auth   |
| ------ | -------------------------------------- | ------------ | ------ |
| GET    | `/api/v1/categories`                   | Cây danh mục | Public |
| GET    | `/api/v1/brands`                       | Thương hiệu  | Public |
| GET    | `/api/v1/products`                     | Tìm kiếm/lọc | Public |
| GET    | `/api/v1/products/:slug`               | Chi tiết     | Public |
| GET    | `/api/v1/skus/:skuCode`                | SKU          | Public |
| GET    | `/api/v1/products/:id/recommendations` | Rule-based   | Public |
| CRUD   | `/api/v1/admin/catalog/...`            | Quản trị     | Staff+ |

Category slugs đã chốt trong contracts: `dien-thoai`, `laptop`, `tablet`, `dong-ho-thong-minh`, `tai-nghe-loa`, `phu-kien`.

---

## media-service — **kế hoạch M4 (chưa có code)**

| Method | Path                    | Mô tả                  | Auth        |
| ------ | ----------------------- | ---------------------- | ----------- |
| POST   | `/api/v1/media/presign` | Presigned upload MinIO | User/Staff  |
| GET    | `/api/v1/media/:id`     | Metadata               | Depends     |
| DELETE | `/api/v1/media/:id`     | Xóa                    | Owner/Staff |

---

## Các service sau M4 (kế hoạch — chưa code)

Giữ nguyên thiết kế trong phiên bản docs trước: inventory, cart, order, payment, shipping, review, warranty, support, notification, reporting. Chi tiết endpoint xem git history / ARCHITECTURE khi triển khai milestone tương ứng.

## Ghi chú v2

`/api/v2` được đăng ký song song từ M3 trên identity/customer. Hành vi hiện mirror v1.
