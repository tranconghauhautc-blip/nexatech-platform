# NexaTech Databases

## Nguyên tắc

- PostgreSQL 16
- Database **per service**
- Prisma ORM + **migrations** (không `db push` production)
- Application role riêng (không dùng superuser `postgres` cho app)
- Không FK cross-service

## Trạng thái persistence sau M3

| Thành phần                             | Trạng thái                                                       |
| -------------------------------------- | ---------------------------------------------------------------- |
| Prisma schema identity                 | ✅ Có — `apps/identity-service/prisma/schema.prisma`             |
| Prisma schema customer                 | ✅ Có — `apps/customer-service/prisma/schema.prisma`             |
| Prisma migrate / client wired vào Nest | ❌ Chưa                                                          |
| Runtime store identity/customer        | **In-memory** (`InMemoryIdentityStore`, `InMemoryCustomerStore`) |
| Redis                                  | Compose sẵn; **chưa** dùng trong code service                    |
| MinIO                                  | Compose sẵn; **chưa** có media-service                           |
| Catalog / media DB                     | ❌ Chưa (M4)                                                     |

## Env database

| Biến                    | Mục đích                    |
| ----------------------- | --------------------------- |
| `IDENTITY_DATABASE_URL` | Postgres identity           |
| `CUSTOMER_DATABASE_URL` | Postgres customer           |
| `REDIS_URL`             | Redis (dự kiến session/OTP) |

Init Compose (`infra/docker/postgres/init-databases.sql`):

- Users: `nexatech_identity`, `nexatech_customer` (password dev `changeme`)
- DBs: `nexatech_identity`, `nexatech_customer`

## Danh sách database (mục tiêu toàn hệ thống)

| Service              | Database name           | Schema status                        |
| -------------------- | ----------------------- | ------------------------------------ |
| identity-service     | `nexatech_identity`     | Prisma schema ✅ / runtime in-memory |
| customer-service     | `nexatech_customer`     | Prisma schema ✅ / runtime in-memory |
| catalog-service      | `nexatech_catalog`      | M4                                   |
| media-service        | `nexatech_media`        | M4                                   |
| inventory-service    | `nexatech_inventory`    | Later                                |
| cart-service         | `nexatech_cart`         | Later                                |
| order-service        | `nexatech_order`        | Later                                |
| payment-service      | `nexatech_payment`      | Later                                |
| shipping-service     | `nexatech_shipping`     | Later                                |
| review-service       | `nexatech_review`       | Later                                |
| warranty-service     | `nexatech_warranty`     | Later                                |
| notification-service | `nexatech_notification` | Later                                |
| support-service      | `nexatech_support`      | Later                                |
| reporting-service    | `nexatech_reporting`    | Later                                |

## identity — Prisma models (đã định nghĩa)

- `User` — email unique, `passwordHash`, `roles String[]`, `status` enum (`PENDING_VERIFICATION` \| `ACTIVE` \| `DISABLED`), `emailVerifiedAt`
- `OAuthAccount` — unique `(provider, providerUserId)`
- `Device` — userAgent, ipHash
- `Session` — `refreshTokenHash`, `expiresAt`, `revokedAt`
- `OtpChallenge` — email, purpose, `codeHash`, expires/consumed

Client generator output: `apps/identity-service/src/generated/prisma`.

## customer — Prisma models (đã định nghĩa)

- `CustomerProfile` — `userId` unique, fullName, phone
- `Address` — shipping fields + `isDefault`
- `CustomerPreference` — locale default `vi-VN`, `marketingOptIn`

Client generator output: `apps/customer-service/src/generated/prisma`.

## Redis (mục tiêu — chưa wire)

| Key pattern               | Mục đích                |
| ------------------------- | ----------------------- |
| `session:{sessionId}`     | Refresh/session payload |
| `user_sessions:{userId}`  | Index phiên             |
| `otp:{purpose}:{subject}` | OTP                     |
| `rate:{route}:{id}`       | Rate limit              |

## MinIO buckets (mục tiêu M4+)

| Bucket                | Nội dung           |
| --------------------- | ------------------ |
| `product-media`       | Ảnh/video sản phẩm |
| `review-media`        | Đánh giá           |
| `support-attachments` | Ticket             |
| `invoices`            | PDF hóa đơn        |
| `misc`                | Khác               |

## catalog / media (M4 — chưa có schema file)

### catalog (dự kiến)

- `Category` (tree `parentId`), `Brand`
- `Product` (slug, categoryId, brandId, status, specs JSON)
- `Sku` / variant attributes
- `Price` + `PriceHistory`
- `ProductMediaRef` (mediaId)

### media (dự kiến)

- `MediaObject` (bucket, objectKey, contentType, size, ownerType, ownerId, createdAt)

## Migration policy

1. Mọi thay đổi schema → Prisma migration
2. Cấm agent tự chạy `prisma migrate reset` / DROP DATABASE
3. Production: migrate job trước rollout
