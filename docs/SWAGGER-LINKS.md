# Swagger Links — Local API Security Lab

## Combined portal (preferred for lab)

| Entry                          | URL                                                          | Ghi chú                            |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------- |
| **Combined Swagger UI (Kong)** | http://localhost:8000/docs                                   | URL chính — tags theo 14 service   |
| Combined Swagger UI (direct)   | http://localhost:8090/docs                                   | Bypass Kong; cùng UI               |
| Health                         | http://localhost:8090/health                                 | Portal process health              |
| OpenAPI YAML                   | http://localhost:8000/openapi/nexatech-combined.openapi.yaml | Download / import Burp·ZAP·Postman |
| OpenAPI JSON                   | http://localhost:8000/openapi/nexatech-combined.openapi.json | Download                           |

- Servers trong combined spec: **Kong** `http://localhost:8000` (mặc định Try it out), direct `http://localhost:{port}`, placeholder production (export only — không dùng Try it out).
- Authorize: Bearer JWT từ Identity `POST /api/v1/auth/login`.
- Portal **chỉ** bật local/lab (`NEXATECH_SWAGGER_PORTAL_ENABLED=1`). **Không** deploy production / không có trong `kong.production.yml`.
- Per-service `/docs` vẫn giữ để debug một service.

Repo export: `openapi/<service>.openapi.yaml` + `openapi/nexatech-combined.openapi.yaml`.

## Per-service Swagger (debug)

Ports từ `infra/docker/docker-compose.apps.yml`. Swagger UI: `/docs`. OpenAPI JSON: `/docs-json`. OpenAPI YAML live: `/docs-yaml`.

| Service      | Direct API            | Swagger                    | OpenAPI JSON                    | Kong URL                                     | Auth                     | Role                         | Security-lab scenarios                          |
| ------------ | --------------------- | -------------------------- | ------------------------------- | -------------------------------------------- | ------------------------ | ---------------------------- | ----------------------------------------------- |
| identity     | http://localhost:3001 | http://localhost:3001/docs | http://localhost:3001/docs-json | http://localhost:8000/api/v1/auth            | Public login + Bearer    | Public / Auth / Staff+       | SC-21, SC-24, SC-59, SC-60, SC-64, SC-65, SC-67 |
| customer     | http://localhost:3002 | http://localhost:3002/docs | http://localhost:3002/docs-json | http://localhost:8000/api/v1/customers       | Bearer / x-user-id       | Customer / Admin             | —                                               |
| catalog      | http://localhost:3003 | http://localhost:3003/docs | http://localhost:3003/docs-json | http://localhost:8000/api/v1/products        | Public read              | Public / Manager+            | SC-63                                           |
| media        | http://localhost:3004 | http://localhost:3004/docs | http://localhost:3004/docs-json | http://localhost:8000/api/v1/media           | Bearer / owner           | Owner / Staff+               | SC-36                                           |
| inventory    | http://localhost:3005 | http://localhost:3005/docs | http://localhost:3005/docs-json | http://localhost:8000/api/v1/warehouses      | x-user-id / roles        | Staff+                       | —                                               |
| cart         | http://localhost:3006 | http://localhost:3006/docs | http://localhost:3006/docs-json | http://localhost:8000/api/v1/cart            | x-user-id / x-cart-token | Guest / Customer             | —                                               |
| order        | http://localhost:3007 | http://localhost:3007/docs | http://localhost:3007/docs-json | http://localhost:8000/api/v1/orders          | x-user-id / roles        | Customer / Staff+            | SC-01, SC-02, SC-12, SC-58                      |
| payment      | http://localhost:3008 | http://localhost:3008/docs | http://localhost:3008/docs-json | http://localhost:8000/api/v1/payments        | x-user-id / webhook      | Customer / Staff+ / Provider | SC-03, SC-17, SC-18, SC-20                      |
| shipping     | http://localhost:3009 | http://localhost:3009/docs | http://localhost:3009/docs-json | http://localhost:8000/api/v1/admin/shipments | x-user-id / webhook      | Customer / Staff+ / Provider | SC-04, SC-61, SC-66                             |
| review       | http://localhost:3010 | http://localhost:3010/docs | http://localhost:3010/docs-json | http://localhost:8000/api/v1/reviews         | x-user-id / roles        | Customer / Staff+            | SC-05                                           |
| warranty     | http://localhost:3011 | http://localhost:3011/docs | http://localhost:3011/docs-json | http://localhost:8000/api/v1/warranty        | x-user-id / roles        | Customer / Staff+            | SC-06                                           |
| support      | http://localhost:3012 | http://localhost:3012/docs | http://localhost:3012/docs-json | http://localhost:8000/api/v1/support         | x-user-id / roles        | Customer / Staff+            | SC-07                                           |
| notification | http://localhost:3013 | http://localhost:3013/docs | http://localhost:3013/docs-json | http://localhost:8000/api/v1/notifications   | x-user-id / roles        | Customer / Manager+          | —                                               |
| reporting    | http://localhost:3014 | http://localhost:3014/docs | http://localhost:3014/docs-json | http://localhost:8000/api/v1/admin/reporting | x-user-roles             | Manager / Admin / SuperAdmin | —                                               |

## Combined Authorize flow

1. Mở http://localhost:8000/docs
2. Server: **Kong Gateway (local)** `http://localhost:8000`
3. Expand **Identity** → `POST /api/v1/auth/login` (seed password từ `DEV_SEED_PASSWORD`)
4. Copy `accessToken` → **Authorize** → Bearer JWT
5. Gọi endpoint protected theo tag service (Customer, Order, …)

## Per-service Authorize (debug)

1. Mở http://localhost:3001/docs
2. Chọn server **same origin as /docs**
3. Login → Authorize → `/api/v1/auth/me`

Frontend BFF dùng cookie httpOnly; Swagger dùng Bearer trực tiếp — không làm yếu cookie production.

Production: combined portal **disabled**; per-service `/docs` nên giới hạn bằng network policy.
