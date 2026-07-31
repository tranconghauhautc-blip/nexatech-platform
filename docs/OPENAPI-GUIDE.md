# OpenAPI Guide — NexaTech

## Mục tiêu

Cung cấp OpenAPI Specification **3.x** hợp lệ để import vào Burp Suite, OWASP ZAP, Postman, Insomnia, Swagger Editor và các công cụ API security testing.

## Thư mục

```
openapi/
  identity-service.openapi.yaml
  identity-service.openapi.json
  … (14 services)
  nexatech-combined.openapi.yaml
  nexatech-combined.openapi.json
```

JSON là nguồn deterministic cho combine/validate; YAML phục vụ import thủ công.

## Lệnh

```powershell
# Cần Docker Compose apps đang chạy (fetch /docs-json)
pnpm openapi:generate
pnpm openapi:combine
pnpm openapi:validate

# Fail nếu service offline:
$env:OPENAPI_REQUIRE_LIVE="1"
pnpm openapi:generate
```

| Script                  | Mô tả                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm openapi:generate` | Bootstrap từ live Swagger `/docs-json`, normalize servers/security/schemas, ghi YAML+JSON |
| `pnpm openapi:combine`  | Gộp 14 spec → `nexatech-combined.openapi.*` với Kong server `http://localhost:8000`       |
| `pnpm openapi:validate` | OpenAPI 3.x, duplicate operationId, ErrorEnvelope, Kong server                            |

Generation là deterministic (sorted keys) để giảm diff vô nghĩa.

## Servers trong mỗi spec (exported `openapi/*`)

1. Direct service `http://localhost:{port}`
2. Kong local `http://localhost:8000`
3. Production placeholder `https://api.example.invalid` (chỉ để nhắc override — **không** dùng Try it out)

## Servers trên Swagger UI live (`/docs`)

1. **Same origin** `/` — mặc định; Try it out gọi đúng host đang mở `/docs`
2. Direct `http://localhost:{port}`
3. Kong `http://localhost:8000`

Không gắn production placeholder trên live UI (tránh Failed to fetch khi chọn `api.example.invalid`).
Không document header `User-Agent` trên login (browser cấm set từ fetch).

## Security schemes

- `bearer` — JWT access token (identity login)
- `userId` / `userRoles` — gateway trust headers
- `requestId` / `traceId` — correlation
- `idempotencyKey` — idempotent writes

**Không** ghi secret, password, hoặc token thật vào spec.

## Swagger runtime

Mỗi Nest service dùng `setupNexaTechSwagger` (`@nexatech/shared-platform`):

- UI: `/docs`
- JSON: `/docs-json`
- YAML: `/docs-yaml`
- `operationIdFactory` ổn định
- `persistAuthorization` + try-it-out

Xem [SWAGGER-LINKS.md](./SWAGGER-LINKS.md).

## Import nhanh

1. Chạy generate + combine
2. Import `openapi/nexatech-combined.openapi.yaml`
3. Chọn server Kong hoặc direct
4. Authorize Bearer từ identity login
