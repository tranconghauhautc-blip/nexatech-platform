# NexaTech Databases

## Nguyên tắc

- PostgreSQL 16
- Database **per service**
- Prisma ORM + **migrations** (không `db push` production)
- Application role riêng (không dùng superuser `postgres` cho app)
- Không FK cross-service

## Trạng thái persistence sau M4

| Thành phần                | Trạng thái                                                               |
| ------------------------- | ------------------------------------------------------------------------ |
| Prisma schema identity    | ✅ Có — chưa wire runtime                                                |
| Prisma schema customer    | ✅ Có — chưa wire runtime                                                |
| Prisma schema catalog     | ✅ Có + migration `20260729120000_init_catalog`                          |
| Prisma schema media       | ✅ Có + migration `20260729130000_init_media`                            |
| Runtime identity/customer | In-memory (M3)                                                           |
| Runtime catalog           | **Prisma** khi `CATALOG_DATABASE_URL`; InMemory chỉ unit/`NODE_ENV=test` |
| Runtime media             | **Prisma** khi `MEDIA_DATABASE_URL`; MinIO khi `MINIO_*`                 |
| Redis                     | Compose sẵn; identity chưa wire                                          |
| MinIO                     | Compose + buckets init; media-service dùng thật                          |

## Env database

| Biến                    | Mục đích          |
| ----------------------- | ----------------- |
| `IDENTITY_DATABASE_URL` | Postgres identity |
| `CUSTOMER_DATABASE_URL` | Postgres customer |
| `CATALOG_DATABASE_URL`  | Postgres catalog  |
| `MEDIA_DATABASE_URL`    | Postgres media    |
| `REDIS_URL`             | Redis             |
| `RABBITMQ_URL`          | RabbitMQ          |
| `MINIO_*`               | Object storage    |

Init Compose (`infra/docker/postgres/init-databases.sql`):

- Users: `nexatech_identity`, `nexatech_customer`, `nexatech_catalog`, `nexatech_media` (password dev `changeme`)
- DBs cùng tên tương ứng

## Danh sách database

| Service              | Database name           | Schema status                                     |
| -------------------- | ----------------------- | ------------------------------------------------- |
| identity-service     | `nexatech_identity`     | Prisma schema ✅ / runtime in-memory              |
| customer-service     | `nexatech_customer`     | Prisma schema ✅ / runtime in-memory              |
| catalog-service      | `nexatech_catalog`      | Prisma + migration ✅ / Prisma repository runtime |
| media-service        | `nexatech_media`        | Prisma + migration ✅ / Prisma repository runtime |
| inventory-service    | `nexatech_inventory`    | Later                                             |
| cart-service         | `nexatech_cart`         | Later                                             |
| order-service        | `nexatech_order`        | Later                                             |
| payment-service      | `nexatech_payment`      | Later                                             |
| shipping-service     | `nexatech_shipping`     | Later                                             |
| review-service       | `nexatech_review`       | Later                                             |
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
