# Swagger Links — Local API Security Lab

Ports từ `infra/docker/docker-compose.apps.yml`. Swagger UI: `/docs`. OpenAPI JSON: `/docs-json`. OpenAPI YAML live: `/docs-yaml` (sau khi service dùng `setupNexaTechSwagger`).

Repo export: `openapi/<service>.openapi.yaml` + `openapi/nexatech-combined.openapi.yaml`.

| Service      | Direct API            | Swagger                    | OpenAPI JSON                    | Kong URL                                     | Auth                     | Role                         | Security-lab scenarios                          |
| ------------ | --------------------- | -------------------------- | ------------------------------- | -------------------------------------------- | ------------------------ | ---------------------------- | ----------------------------------------------- |
| identity     | http://localhost:3001 | http://localhost:3001/docs | http://localhost:3001/docs-json | http://localhost:8000/api/v1/auth            | Public login + Bearer    | Public / Auth / Staff+       | SC-21, SC-24, SC-59, SC-60, SC-64, SC-65, SC-67 |
| customer     | http://localhost:3002 | http://localhost:3002/docs | http://localhost:3002/docs-json | http://localhost:8000/api/v1/customers       | Bearer / x-user-id       | Customer / Admin             | —                                               |
| catalog      | http://localhost:3003 | http://localhost:3003/docs | http://localhost:3003/docs-json | http://localhost:8000/api/v1/products        | Public read              | Public / Manager+            | SC-63                                           |
| media        | http://localhost:3004 | http://localhost:3004/docs | http://localhost:3004/docs-json | http://localhost:8000/api/v1/media           | Bearer / owner           | Owner / Staff+               | SC-36                                           |
| inventory    | http://localhost:3005 | http://localhost:3005/docs | http://localhost:3005/docs-json | http://localhost:8000/api/v1/inventory       | x-user-id / roles        | Staff+                       | —                                               |
| cart         | http://localhost:3006 | http://localhost:3006/docs | http://localhost:3006/docs-json | http://localhost:8000/api/v1/cart            | x-user-id / x-cart-token | Guest / Customer             | —                                               |
| order        | http://localhost:3007 | http://localhost:3007/docs | http://localhost:3007/docs-json | http://localhost:8000/api/v1/orders          | x-user-id / roles        | Customer / Staff+            | SC-01, SC-02, SC-12, SC-58                      |
| payment      | http://localhost:3008 | http://localhost:3008/docs | http://localhost:3008/docs-json | http://localhost:8000/api/v1/payments        | x-user-id / webhook      | Customer / Staff+ / Provider | SC-03, SC-17, SC-18, SC-20                      |
| shipping     | http://localhost:3009 | http://localhost:3009/docs | http://localhost:3009/docs-json | http://localhost:8000/api/v1/shipping        | x-user-id / webhook      | Customer / Staff+ / Provider | SC-04, SC-61, SC-66                             |
| review       | http://localhost:3010 | http://localhost:3010/docs | http://localhost:3010/docs-json | http://localhost:8000/api/v1/reviews         | x-user-id / roles        | Customer / Staff+            | SC-05                                           |
| warranty     | http://localhost:3011 | http://localhost:3011/docs | http://localhost:3011/docs-json | http://localhost:8000/api/v1/warranty        | x-user-id / roles        | Customer / Staff+            | SC-06                                           |
| support      | http://localhost:3012 | http://localhost:3012/docs | http://localhost:3012/docs-json | http://localhost:8000/api/v1/support         | x-user-id / roles        | Customer / Staff+            | SC-07                                           |
| notification | http://localhost:3013 | http://localhost:3013/docs | http://localhost:3013/docs-json | http://localhost:8000/api/v1/notifications   | x-user-id / roles        | Customer / Manager+          | —                                               |
| reporting    | http://localhost:3014 | http://localhost:3014/docs | http://localhost:3014/docs-json | http://localhost:8000/api/v1/admin/reporting | x-user-roles             | Manager / Admin / SuperAdmin | —                                               |

## Identity Swagger Authorize flow

1. Mở http://localhost:3001/docs
2. `POST /api/v1/auth/login` với seed account (password từ `DEV_SEED_PASSWORD`)
3. Copy `accessToken` (không copy refresh token ra ngoài phạm vi cần thiết)
4. Bấm **Authorize** → Bearer JWT
5. `GET /api/v1/auth/me`
6. `POST /api/v1/auth/refresh` rồi thử token cũ (contract: session cũ bị thu hồi)
7. `POST /api/v1/auth/logout` với `sessionId`

Frontend BFF dùng cookie httpOnly; Swagger dùng Bearer trực tiếp — không làm yếu cookie production.

Production có thể tắt/giới hạn `/docs` bằng network policy (không bắt buộc public Swagger qua Kong).
