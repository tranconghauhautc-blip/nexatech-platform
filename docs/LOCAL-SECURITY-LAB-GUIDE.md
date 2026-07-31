# Local Security Lab Guide — NexaTech

Hướng dẫn biến stack local thành môi trường web/API security training hoàn chỉnh (không chỉ “test xanh”).

## 0. Điều kiện

- Docker Desktop đang chạy
- Node 22+, pnpm 10+
- Repo `nexatech-platform`

## 1–2. Bật infra Compose

```powershell
cd D:\NexaTech\nexatech-platform
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Chờ Postgres, Redis, RabbitMQ, MinIO healthy.

## 3. Migrations

Chạy `prisma migrate deploy` cho từng service có schema (hoặc Helm migrate Jobs trên K8s). Local nhanh: dùng DB đã init từ Compose + migration scripts hiện có trong từng `apps/*/prisma`.

## 4. Seed catalog

```powershell
pnpm seed:catalog
```

## 5. Seed 4 role account

```powershell
$env:NODE_ENV="development"
$env:NEXATECH_ALLOW_DEV_SEED="YES"
$env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
$env:IDENTITY_DATABASE_URL="postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity"
pnpm seed:accounts
```

Emails: `staff@nexatech.local`, `manager@nexatech.local`, `admin@nexatech.local`, `superadmin@nexatech.local`.

Gate bắt buộc: `NODE_ENV != production`, `NEXATECH_ALLOW_DEV_SEED=YES`, `DEV_SEED_PASSWORD` hợp lệ. Không hard-code password.

## 6. Bật app Compose

```powershell
docker compose -f infra/docker/docker-compose.apps.yml up -d --build
```

## 7–8. Mở storefront & admin

- Storefront: http://localhost:3000
- Admin: http://localhost:3100

Bảng đầy đủ: [LOCAL-LAB-LINKS.md](./LOCAL-LAB-LINKS.md).

## 9. Login / logout

### Storefront

- `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/xac-minh-email`, `/tai-khoan`
- Logout qua account menu → BFF `POST /api/auth/logout` (xoá cookie + revoke session)

### Admin

- `/dang-nhap`
- Logout trên Topbar
- `/unauthorized` (chưa đăng nhập)
- `/forbidden` (thiếu RBAC)
- Menu lọc theo Staff / Manager / Admin / SuperAdmin
- Route guard theo `minimumRole` của menu

### Playwright 4-role smoke

```powershell
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
$env:PLAYWRIGHT_ADMIN_URL="http://127.0.0.1:3100"
$env:E2E_DEV_SEED_PASSWORD=$env:DEV_SEED_PASSWORD
pnpm e2e:admin
```

## 10–13. Swagger + Authorize + call API

1. Mở http://localhost:3001/docs (và các service 3002–3014 — [SWAGGER-LINKS.md](./SWAGGER-LINKS.md))
2. Login → lấy `accessToken`
3. Authorize (Bearer)
4. Gọi `/api/v1/auth/me` và endpoint protected khác
5. Quan sát status / header / body trong Swagger

Kong: http://localhost:8000 (forward Authorization + correlation headers).

## 14. Export / import OpenAPI 3

```powershell
pnpm openapi:generate
pnpm openapi:combine
pnpm openapi:validate
```

Import `openapi/nexatech-combined.openapi.yaml` vào Burp/ZAP/Postman. Chi tiết: [OPENAPI-GUIDE.md](./OPENAPI-GUIDE.md).

## 15–16. Secure tests & lab PoC

```powershell
pnpm security:test:secure
$env:SECURITY_LAB_ACK="YES"
pnpm security:test:lab
pnpm security:validate
```

Lab HTTP marker (khi profile lab bật): `GET http://localhost:3001/health/lab`.

Coverage API1–API10 và A01–A10: [OWASP-SCENARIOS.md](./OWASP-SCENARIOS.md).

## 17. Xem log

```powershell
docker compose -f infra/docker/docker-compose.apps.yml logs -f identity-service
```

Không in refresh token / secret ra log shared.

## 18. Reset test data an toàn

- Re-seed accounts: `DEV_SEED_RESET_PASSWORD=YES pnpm seed:accounts` (chỉ account `isDevSeed`)
- **Không** chạy `prisma migrate reset` / `DROP DATABASE` trừ khi operator xác nhận
- Không xoá volume Docker trừ khi chủ đích

## 19. Tắt stack (giữ volume)

```powershell
docker compose -f infra/docker/docker-compose.apps.yml stop
docker compose -f infra/docker/docker-compose.dev.yml stop
```

## Security-lab dashboard

`http://localhost:3100/security-lab` chỉ render khi:

- `NEXATECH_SECURITY_LAB=1`
- `NEXATECH_DEPLOY_PROFILE=security-lab`

Production artifact không route/render trang này.

## Smoke HTTP bắt buộc

```powershell
pnpm lab:smoke
```

Kiểm tra 14 backend health + Swagger + OpenAPI JSON + storefront/admin/Kong (không chỉ unit test).

## Production safety checklist

- Không bật lỗ hổng lab
- Không lab dashboard / lab image
- Không public RabbitMQ/MinIO management
- Không `DEV_SEED_PASSWORD` / seed account trên prod
- `pnpm security:test:secure` xanh
