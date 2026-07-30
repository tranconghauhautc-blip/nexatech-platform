# NexaTech Architecture

## 1. Tổng quan

NexaTech là nền tảng thương mại điện tử microservices bán thiết bị công nghệ cá nhân bằng tiếng Việt:

- Điện thoại, laptop, tablet
- Đồng hồ thông minh
- Tai nghe và loa
- Phụ kiện

Không bao gồm voucher, mã giảm giá, flash sale, SIM, thiết bị mạng hoặc thiết bị gia dụng.

## 2. Kiến trúc tổng thể

```text
                         ┌─────────────────────┐
                         │   Kong Gateway OSS  │
                         │  /api/v1 , /api/v2  │
                         └──────────┬──────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────▼────────┐         ┌────────▼────────┐         ┌────────▼────────┐
│ storefront-web │         │   admin-web     │         │  Microservices  │
│   (Next.js)    │         │   (Next.js)     │         │    (NestJS)     │
└────────────────┘         └─────────────────┘         └────────┬────────┘
                                                                │
              ┌─────────────────────┬───────────────────────────┼──────────┐
              │                     │                           │          │
       ┌──────▼──────┐       ┌──────▼──────┐             ┌──────▼──────┐   │
       │ PostgreSQL  │       │    Redis    │             │  RabbitMQ   │   │
       │ (per svc DB)│       │ session/OTP │             │   events    │   │
       └─────────────┘       └─────────────┘             └─────────────┘   │
                                                                   ┌───────▼──────┐
                                                                   │    MinIO     │
                                                                   │ media/files  │
                                                                   └──────────────┘
```

## 3. Frontend

| App              | Vai trò              | Công nghệ                                  | Port local |
| ---------------- | -------------------- | ------------------------------------------ | ---------- |
| `storefront-web` | Cửa hàng khách hàng  | Next.js 15 App Router, TypeScript, BFF     | 3000       |
| `admin-web`      | Cổng quản trị nội bộ | Next.js 15 App Router, TypeScript, RBAC UI | 3100       |

**M15–M16:** Frontend BFF `/api/bff/{service}`; Kong local declarative (`infra/kong/kong.yml`) cho `/api/v1`. Session httpOnly (ADR-034). Backend Dockerfiles + compose apps (ADR-035). Identity/customer Prisma khi có DATABASE_URL.

Shared FE: `libs/shared/web` (`formatVnd`, `ApiClient`, error envelope mapping, admin menu helpers).

Cả hai frontend không index admin (`robots` disallow); storefront có metadata/OG/sitemap-ready.

## 4. Backend microservices

| Service                | Phạm vi dữ liệu                                              | Ghi chú                                        |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `identity-service`     | User, credential, session, device, RBAC, OAuth               | JWT access + refresh/session Redis             |
| `customer-service`     | Hồ sơ khách, địa chỉ, preference                             | Liên kết `userId` từ identity                  |
| `catalog-service`      | Category, brand, product, variant, SKU, price history, specs | Search/filter                                  |
| `inventory-service`    | Warehouse, store, stock, reservation, transfer               | Giữ/trừ/hoàn tồn                               |
| `cart-service`         | Guest/user cart, wishlist, comparison, recently viewed       | Merge cart khi login                           |
| `order-service`        | Order, shipment split, invoice PDF metadata                  | Orchestrate checkout                           |
| `payment-service`      | COD, mock, VNPay Sandbox                                     | Adapter pattern                                |
| `shipping-service`     | Carrier adapter, tracking, packages                          | Tích hợp vận chuyển                            |
| `review-service`       | Review, media review (ảnh/video)                             | Chỉ khách đã mua                               |
| `warranty-service`     | Bảo hành, đổi trả                                            | Liên kết order/SKU                             |
| `notification-service` | Email, in-app notification                                   | Consume events (inbox M13)                     |
| `support-service`      | Ticket hỗ trợ                                                | Staff/Manager xử lý                            |
| `reporting-service`    | Dashboard metrics, audit log projection                      | Read model + audit; consume events (inbox M14) |
| `media-service`        | Upload/presign MinIO, metadata                               | Ảnh sản phẩm, review, ticket                   |

Mỗi service:

- Chỉ sở hữu database của mình
- Expose REST `/api/v1` và `/api/v2`
- Có Swagger, health/readiness/liveness
- Giao tiếp đồng bộ bằng REST, bất đồng bộ bằng RabbitMQ
- Dùng shared libraries cho contract, error, auth, logging

## 5. Shared libraries (Nx)

| Library                 | Mục đích                                           |
| ----------------------- | -------------------------------------------------- |
| `libs/shared/contracts` | DTO, API request/response types, OpenAPI fragments |
| `libs/shared/events`    | Event payload schemas, routing keys                |
| `libs/shared/errors`    | `errorCode`, message, details, traceId, timestamp  |
| `libs/shared/auth`      | JWT claims, RBAC roles/permissions, guards helpers |
| `libs/shared/config`    | Env schema validation (Zod)                        |
| `libs/shared/logging`   | requestId/traceId correlation                      |
| `libs/shared/testing`   | Test utilities, factories                          |
| `libs/shared/ui`        | Shared UI primitives (nếu cần giữa 2 frontend)     |

## 6. Authentication & Authorization

1. Đăng ký/đăng nhập email + mật khẩu
2. Google OAuth
3. Xác minh email, quên mật khẩu, OTP email
4. Access token JWT (ngắn hạn)
5. Refresh token + session lưu Redis (thiết bị/phiên)
6. RBAC: `Customer`, `Staff`, `Manager`, `Admin`, `SuperAdmin`

Kong xác thực JWT ở edge (khi khả thi); service vẫn validate claim và RBAC.

## 7. Luồng nghiệp vụ chính

### 7.1 Catalog & Media

Catalog quản lý sản phẩm/biến thể/giá. Media-service cấp presigned URL MinIO. Storefront đọc catalog public.

### 7.2 Cart → Checkout → Order

1. Guest/user thêm vào cart
2. Login → merge cart
3. Checkout: validate tồn kho (inventory reserve)
4. Order-service tạo đơn, có thể tách nhiều kiện
5. Payment-service xử lý COD / mock / VNPay
6. Inventory confirm hoặc release
7. Shipping tạo vận đơn và tracking
8. Notification gửi email + in-app

### 7.3 Post-purchase

- Review (verified purchase)
- Warranty/return
- Support ticket
- Reporting/audit

## 8. Data ownership

Database-per-service trên PostgreSQL 16. Không share bảng giữa service. Tra cứu chéo qua ID và REST/events.

Redis dùng cho:

- Session / refresh token
- OTP
- Rate limit (khi triển khai)
- Cache ngắn hạn (tuỳ service)

MinIO dùng object storage cho media.

## 9. API Gateway (Kong)

- Route `/api/v1/*` và `/api/v2/*` tới service tương ứng
- CORS, rate limiting cơ bản
- JWT plugin (identity-issued)
- Health upstream checks

## 10. Observability tối thiểu

- Structured logging với `requestId`, `traceId`
- Unified error envelope
- Health/readiness/liveness mỗi service
- Audit log cho hành động nhạy cảm (reporting-service + emit event)

## 11. Deployment

- Mỗi app có Dockerfile riêng (Linux)
- Image tag theo version/semver (không dùng `latest`)
- Local: Docker Compose (Postgres, Redis, RabbitMQ, MinIO, services)
- Production: Kubernetes + Helm + Kong

## 12. Nguyên tắc thiết kế

1. Business logic thật trước, không placeholder rỗng
2. Strict TypeScript
3. Prisma migrations (không `db push` production)
4. App DB user riêng (không dùng role `postgres`)
5. Secret chỉ qua env / secret store
6. Contract-first trong shared libs
7. OWASP API scenarios sau khi business ổn định (M21)
