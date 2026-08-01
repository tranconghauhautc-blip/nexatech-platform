# Local Lab Links — NexaTech Security Training

Ports lấy từ `infra/docker/docker-compose.dev.yml` và `infra/docker/docker-compose.apps.yml` (không đoán).

**Không ghi password thật vào tài liệu này.** Credential lấy từ biến môi trường / Compose defaults (local only).

| Thành phần          | URL                                | Chức năng                       | Credential source                                                | Production exposure                | Ghi chú bảo mật                                                        |
| ------------------- | ---------------------------------- | ------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Storefront          | http://localhost:3000              | Website khách                   | Session cookie `nt_session` (BFF httpOnly)                       | Public web                         | Không lộ access token cho JS                                           |
| Admin Portal        | http://localhost:3100              | Cổng quản trị RBAC              | Session cookie `nexatech_admin_session` + `ADMIN_SESSION_SECRET` | Internal / VPN                     | Route guard + menu theo role                                           |
| Kong Gateway        | http://localhost:8000              | API gateway `/api/v1` `/api/v2` | Forward `Authorization` / cookies                                | Edge API                           | CORS local; production dùng VIP riêng                                  |
| **Combined Swagger** | http://localhost:8000/docs        | OpenAPI 3 UI đủ 14 services     | Bearer từ Identity login                                         | **Không** production               | Lab/dev only — `swagger-portal` + Kong route; direct :8090 cũng được |
| Combined OpenAPI    | http://localhost:8000/openapi/nexatech-combined.openapi.yaml | Download YAML/JSON | —                                                                | **Không** production               | JSON: `/openapi/nexatech-combined.openapi.json`                        |
| Swagger portal      | http://localhost:8090/docs         | Same UI bypass Kong             | `NEXATECH_SWAGGER_PORTAL_ENABLED=1`                              | **Không** production               | Health: http://localhost:8090/health                                   |
| Kong Admin          | http://localhost:8001              | Kong admin API                  | Local Compose only                                               | **Không public production**        | Chỉ lab/dev                                                            |
| RabbitMQ Management | http://localhost:15672             | Hàng đợi / exchange UI          | Compose RabbitMQ defaults (local)                                | **Không public production**        | ClusterIP trong Helm prod                                              |
| MinIO Console       | http://localhost:9001              | Object storage UI               | Compose MinIO root (local)                                       | **Không public production**        | ClusterIP trong Helm prod                                              |
| MinIO S3 API        | http://localhost:9000              | S3-compatible API               | Same as console (local)                                          | **Không public production**        | Media via media-service                                                |
| PostgreSQL          | localhost:5432                     | DB per-service                  | `*_DATABASE_URL` / Compose init                                  | Private                            | Không dùng user `postgres` cho app                                     |
| Redis               | localhost:6379                     | Session / cache                 | `REDIS_URL`                                                      | Private                            |                                                                        |
| Identity API        | http://localhost:3001              | Auth / RBAC                     | JWT / seed accounts                                              | Via Kong                           | Swagger `/docs`                                                        |
| Customer API        | http://localhost:3002              | Hồ sơ KH                        | Bearer / `x-user-id`                                             | Via Kong                           |                                                                        |
| Catalog API         | http://localhost:3003              | Catalog                         | Public read                                                      | Via Kong                           |                                                                        |
| Media API           | http://localhost:3004              | Media                           | Owner / staff                                                    | Via Kong                           |                                                                        |
| Inventory API       | http://localhost:3005              | Tồn kho                         | Staff+                                                           | Via Kong                           |                                                                        |
| Cart API            | http://localhost:3006              | Giỏ hàng                        | Guest token / user                                               | Via Kong                           |                                                                        |
| Order API           | http://localhost:3007              | Đơn hàng                        | Customer / staff                                                 | Via Kong                           | OWASP BOLA lab                                                         |
| Payment API         | http://localhost:3008              | Thanh toán                      | Customer / webhook                                               | Via Kong                           |                                                                        |
| Shipping API        | http://localhost:3009              | Vận chuyển                      | Customer / provider                                              | Via Kong                           |                                                                        |
| Review API          | http://localhost:3010              | Đánh giá                        | Customer / staff                                                 | Via Kong                           |                                                                        |
| Warranty API        | http://localhost:3011              | Bảo hành                        | Customer / staff                                                 | Via Kong                           |                                                                        |
| Support API         | http://localhost:3012              | Ticket                          | Customer / staff                                                 | Via Kong                           |                                                                        |
| Notification API    | http://localhost:3013              | Thông báo                       | Customer / manager                                               | Via Kong                           |                                                                        |
| Reporting API       | http://localhost:3014              | Báo cáo                         | Manager+                                                         | Via Kong                           |                                                                        |
| Security Lab UI     | http://localhost:3100/security-lab | Dashboard OWASP lab             | Admin session (Staff+)                                           | Always-on vulnerable PoC           | ADR-044 — không cần dual gate                                      |
| OWASP API Guide     | http://localhost:3200/security-guide/guides/owasp-api-top10 | Authenticated HTML guide (API) | Security Guide login | **Không** public recipes | Storefront `/lab/…` chỉ redirect stub |
| OWASP Web Guide     | http://localhost:3200/security-guide/guides/owasp-web-top10 | Authenticated HTML guide (Web) | Security Guide login | **Không** public recipes | Storefront `/lab/…` chỉ redirect stub |
| **Security Guide**  | http://localhost:3200/security-guide           | Authenticated exploit portal      | `pnpm security-guide:setup` → `.env.security-guide.local` | **Không** production            | Fail-closed; SSoT + HTML guides behind auth               |

## Seed accounts (local)

```powershell
$env:NODE_ENV="development"
$env:NEXATECH_ALLOW_DEV_SEED="YES"
$env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
$env:IDENTITY_DATABASE_URL="postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity"
pnpm seed:accounts
```

Emails: `staff@nexatech.local`, `manager@nexatech.local`, `admin@nexatech.local`, `superadmin@nexatech.local`.

Xem thêm: [LOCAL-SECURITY-LAB-GUIDE.md](./LOCAL-SECURITY-LAB-GUIDE.md), [SWAGGER-LINKS.md](./SWAGGER-LINKS.md).

## Combined Swagger portal

```powershell
docker compose -f infra/docker/docker-compose.apps.yml up -d --build swagger-portal kong
# UI: http://localhost:8000/docs  (hoặc http://localhost:8090/docs)
pnpm lab:smoke
```

Portal **không** có trong `infra/kong/kong.production.yml`. Production giữ disabled.
