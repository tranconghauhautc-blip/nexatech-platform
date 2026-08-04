# 03 — Catalog & Media Use Cases

Services: `catalog-service`, `media-service`
Prefixes: public catalog roots; `/api/v1/admin/catalog/*`; `/api/v1/media/*`

---

## UC-CAT-01 — Browse categories & brands

| Field                             | Content                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| **Use case ID**                   | UC-CAT-01                                                  |
| **Name**                          | Duyệt danh mục & thương hiệu / Browse categories & brands  |
| **Actor**                         | A01 Guest, A02 Customer                                    |
| **Supporting actors/services**    | catalog-service; storefront BFF `/api/bff/catalog/...`     |
| **Preconditions**                 | Seed/admin data exists                                     |
| **Trigger**                       | Home / nav / filters                                       |
| **Input**                         | None / query as implemented                                |
| **Main flow**                     | `GET /categories`, `GET /brands`                           |
| **Alternate flows**               | Empty catalogs                                             |
| **Error flows**                   | Upstream unavailable via BFF                               |
| **Authorization**                 | Public                                                     |
| **Database changes**              | None                                                       |
| **Events produced**               | None                                                       |
| **Events consumed**               | None                                                       |
| **API endpoints**                 | `GET /api/v1/categories`, `GET /api/v1/brands`             |
| **Response contract**             | Category/Brand DTOs                                        |
| **Idempotency rule**              | N/A                                                        |
| **Postconditions**                | —                                                          |
| **Automated test mapping**        | `catalog.controller.spec.ts`, repository integration specs |
| **Current implementation status** | **Implemented**                                            |
| **Known gaps**                    | —                                                          |

---

## UC-CAT-02 — Search / list products with facets

| Field                             | Content                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| **Use case ID**                   | UC-CAT-02                                                          |
| **Name**                          | Tìm / liệt kê sản phẩm + facets / Product list & facets            |
| **Actor**                         | A01, A02                                                           |
| **Supporting actors/services**    | catalog-service                                                    |
| **Preconditions**                 | Products published                                                 |
| **Trigger**                       | Catalog listing / search UI                                        |
| **Input**                         | Query filters (facets endpoint separate)                           |
| **Main flow**                     | `GET /products`, `GET /products/facets`, `GET /products/summaries` |
| **Alternate flows**               | Summaries by ids for thumbs                                        |
| **Error flows**                   | Invalid query                                                      |
| **Authorization**                 | Public                                                             |
| **Database changes**              | None                                                               |
| **Events produced**               | None                                                               |
| **Events consumed**               | None                                                               |
| **API endpoints**                 | `GET /api/v1/products`, `/products/facets`, `/products/summaries`  |
| **Response contract**             | Product list / facet / summary DTOs                                |
| **Idempotency rule**              | N/A                                                                |
| **Postconditions**                | —                                                                  |
| **Automated test mapping**        | catalog unit/integration specs                                     |
| **Current implementation status** | **Implemented**                                                    |
| **Known gaps**                    | —                                                                  |

---

## UC-CAT-03 — Product detail by slug & SKU price

| Field                             | Content                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-CAT-03                                                                                             |
| **Name**                          | Chi tiết sản phẩm / SKU / Product detail & SKU                                                        |
| **Actor**                         | A01, A02                                                                                              |
| **Supporting actors/services**    | catalog-service; media download-url for images                                                        |
| **Preconditions**                 | Product/SKU exists                                                                                    |
| **Trigger**                       | PDP navigation                                                                                        |
| **Input**                         | `:slug` / `:skuCode`                                                                                  |
| **Main flow**                     | `GET /products/:slug` → variants/SKUs; `GET /skus/:skuCode` includes price + `product.thumbnailUrl`   |
| **Alternate flows**               | Recommendations `GET /products/:id/recommendations` (rule-based)                                      |
| **Error flows**                   | 404 not found                                                                                         |
| **Authorization**                 | Public                                                                                                |
| **Database changes**              | None                                                                                                  |
| **Events produced**               | None                                                                                                  |
| **Events consumed**               | None                                                                                                  |
| **API endpoints**                 | `GET /api/v1/products/:slug`, `GET /api/v1/skus/:skuCode`, `GET /api/v1/products/:id/recommendations` |
| **Response contract**             | Product detail / SkuWithPrice                                                                         |
| **Idempotency rule**              | N/A                                                                                                   |
| **Postconditions**                | —                                                                                                     |
| **Automated test mapping**        | catalog specs; order-service uses SkuWithPrice for `imageMediaId`                                     |
| **Current implementation status** | **Implemented**                                                                                       |
| **Known gaps**                    | —                                                                                                     |

---

## UC-CAT-04 — Admin manage catalog (categories, brands, specs, products, SKUs, prices)

| Field                             | Content                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ | -------- | ---- | -------------- | --------------- | ------- |
| **Use case ID**                   | UC-CAT-04                                                                                                   |
| **Name**                          | Quản trị catalog / Admin catalog CRUD                                                                       |
| **Actor**                         | A03 Staff+ (API); UI menu Manager+ for product/category/brand/spec pages                                    |
| **Supporting actors/services**    | catalog-service; admin-web BFF                                                                              |
| **Preconditions**                 | Staff+ headers                                                                                              |
| **Trigger**                       | Admin product/category/brand/spec screens                                                                   |
| **Input**                         | Create/patch bodies; price change payload                                                                   |
| **Main flow**                     | CRUD under `/admin/catalog/*` including media-links and price history write                                 |
| **Alternate flows**               | `PATCH products/:id/status` publish/unpublish                                                               |
| **Error flows**                   | Forbidden if not Staff+; validation                                                                         |
| **Authorization**                 | `hasMinimumRole(..., Roles.Staff)` on every admin method                                                    |
| **Database changes**              | Category, Brand, SpecTemplate/Group/Attribute, Product, Variant, Sku, Price, PriceHistory, ProductMediaLink |
| **Events produced**               | In-process `auditEvents` only (`CATALOG_*`) — **not RabbitMQ**                                              |
| **Events consumed**               | None                                                                                                        |
| **API endpoints**                 | `POST/PATCH /api/v1/admin/catalog/categories                                                                | brands | products | skus | spec-templates | .../media-links | prices` |
| **Response contract**             | Admin catalog DTOs                                                                                          |
| **Idempotency rule**              | None                                                                                                        |
| **Postconditions**                | Catalog data updated; price history appended on price POST                                                  |
| **Automated test mapping**        | `catalog.service.spec.ts`, `catalog.controller.spec.ts`, `catalog.repository.integration.spec.ts`           |
| **Current implementation status** | **Implemented** (API) / **Partial** (events)                                                                |
| **Known gaps**                    | No RabbitMQ publish; UI requires Manager while API allows Staff                                             |

---

## UC-MED-01 — Presign upload & confirm

| Field                             | Content                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-MED-01                                                                                                                   |
| **Name**                          | Upload media (presign → confirm) / Presign & confirm                                                                        |
| **Actor**                         | A02 Customer, A03–A06 Staff+                                                                                                |
| **Supporting actors/services**    | media-service; MinIO                                                                                                        |
| **Preconditions**                 | MinIO credentials at runtime; `x-user-id`                                                                                   |
| **Trigger**                       | Upload avatar / review media / product media                                                                                |
| **Input**                         | Presign request; then confirm after PUT to storage                                                                          |
| **Main flow**                     | `POST /media/presign` → client uploads → `POST /media/:id/confirm`                                                          |
| **Alternate flows**               | Link entity `POST /media/:id/links`                                                                                         |
| **Error flows**                   | Unauthorized; MinIO failure; confirm by non-owner (non-staff)                                                               |
| **Authorization**                 | Owner-or-staff for confirm/delete/download (public owner types for some download); Staff for links; Manager+ orphan cleanup |
| **Database changes**              | `MediaObject`, `MediaLink`, `MediaAuditLog`                                                                                 |
| **Events produced**               | In-memory `MEDIA_UPLOADED` / `MEDIA_DELETED` / `AUDIT_RECORDED` — **not RabbitMQ**                                          |
| **Events consumed**               | None                                                                                                                        |
| **API endpoints**                 | `POST /api/v1/media/presign`, `POST /api/v1/media/:id/confirm`, `POST /api/v1/media/:id/links`                              |
| **Response contract**             | Presign URL + media DTOs                                                                                                    |
| **Idempotency rule**              | None                                                                                                                        |
| **Postconditions**                | Media READY and optionally linked                                                                                           |
| **Automated test mapping**        | `media.service.spec.ts`, `media.controller.spec.ts`, MinIO/integration specs                                                |
| **Current implementation status** | **Implemented**                                                                                                             |
| **Known gaps**                    | Events not on RabbitMQ                                                                                                      |

---

## UC-MED-02 — Download URL & metadata

| Field                             | Content                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-MED-02                                                                                     |
| **Name**                          | Lấy URL tải / metadata / Download URL & get media                                             |
| **Actor**                         | A01 (metadata/by-entity), A02, Staff                                                          |
| **Supporting actors/services**    | media-service; admin/storefront thumbs                                                        |
| **Preconditions**                 | Media id exists                                                                               |
| **Trigger**                       | Render image/video                                                                            |
| **Input**                         | `:id` or by-entity path                                                                       |
| **Main flow**                     | `GET /media/:id`, `GET /media/:id/download-url`, `GET /media/by-entity/:entityType/:entityId` |
| **Alternate flows**               | —                                                                                             |
| **Error flows**                   | Not found; forbidden download                                                                 |
| **Authorization**                 | Metadata + by-entity public; download owner-or-staff (+ public owner types)                   |
| **Database changes**              | None                                                                                          |
| **Events produced**               | None                                                                                          |
| **Events consumed**               | None                                                                                          |
| **API endpoints**                 | `GET /api/v1/media/:id`, `.../download-url`, `.../by-entity/...`                              |
| **Response contract**             | Media DTO / signed URL                                                                        |
| **Idempotency rule**              | N/A                                                                                           |
| **Postconditions**                | —                                                                                             |
| **Automated test mapping**        | media specs                                                                                   |
| **Current implementation status** | **Implemented**                                                                               |
| **Known gaps**                    | —                                                                                             |

---

## UC-MED-03 — Delete media & admin orphan cleanup

| Field                             | Content                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Use case ID**                   | UC-MED-03                                                              |
| **Name**                          | Xóa media / dọn orphan / Delete & cleanup                              |
| **Actor**                         | Owner or Staff; Manager+ for cleanup                                   |
| **Supporting actors/services**    | media-service                                                          |
| **Preconditions**                 | Media exists                                                           |
| **Trigger**                       | Delete action / admin cleanup job                                      |
| **Input**                         | `:id` or cleanup POST body                                             |
| **Main flow**                     | `DELETE /media/:id`; `POST /media/admin/cleanup-orphans`               |
| **Alternate flows**               | —                                                                      |
| **Error flows**                   | Forbidden                                                              |
| **Authorization**                 | Owner-or-staff delete; Manager+ cleanup                                |
| **Database changes**              | Media soft/hard delete per impl; audit log                             |
| **Events produced**               | In-memory delete audit                                                 |
| **Events consumed**               | None                                                                   |
| **API endpoints**                 | `DELETE /api/v1/media/:id`, `POST /api/v1/media/admin/cleanup-orphans` |
| **Response contract**             | Ack / cleanup summary                                                  |
| **Idempotency rule**              | None                                                                   |
| **Postconditions**                | Object removed or marked                                               |
| **Automated test mapping**        | media specs                                                            |
| **Current implementation status** | **Implemented**                                                        |
| **Known gaps**                    | —                                                                      |

---

## Domain summary

| Status      | Notes                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Implemented | Public catalog browse/detail; admin catalog CRUD; media presign pipeline |
| Partial     | Catalog/media “events” are in-memory only                                |
| Gap         | No RabbitMQ for catalog/media despite shared event type constants        |
| Gap         | UI Manager vs API Staff for catalog admin pages                          |
