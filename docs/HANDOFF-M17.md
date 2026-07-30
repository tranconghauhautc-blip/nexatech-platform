# Handoff — Chuẩn bị M17

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M17 trước DoD M16.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                                      |
| -------------- | ------------------------------------------------------------ |
| Path           | `d:\NexaTech\nexatech-platform`                              |
| Branch         | `main`                                                       |
| Milestone xong | M0–**M16** (Docker backends / Kong / E2E / seed / Prisma ID) |
| Milestone tiếp | **M17** — xem gợi ý bên dưới                                 |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`                |
| Next.js        | **15.2.4**                                                   |

### Projects

- 14 Nest backends (Dockerfiles) + storefront-web + admin-web
- Kong declarative + compose apps
- Playwright `e2e/`

---

## 2. M16 đã giao

- Dockerfile multi-stage từng Nest service + `infra/docker/docker-compose.apps.yml`
- Kong `infra/kong/kong.yml` routes `/api/v1`/`/api/v2`
- Identity/customer Prisma runtime + migrations
- Catalog seed ~100 SP (`pnpm seed:catalog`)
- Playwright smoke storefront/admin
- BFF hardening (path sanitize, timeout, safe 502)
- ADR-035

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='change-me-access-secret-min-32-chars'
$env:ADMIN_SESSION_SECRET='change-me-admin-session-secret-min-16'
pnpm format; pnpm lint; pnpm test; pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

Infra:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
# migrate identity/customer/catalog... rồi seed
pnpm seed:catalog
```

---

## 4. Gợi ý phạm vi M17 (dự kiến)

- Wire JWT guards thay `x-user-*` header giả lập (edge Kong JWT + service verify)
- Google OAuth thật + OTP email qua notification
- Mở rộng Playwright: login → cart merge → checkout MOCK end-to-end với Compose
- Helm chart skeleton / K8s manifests (hoặc M19 theo roadmap)
- Patch Next.js 15.x CVE nếu cần

**Không** bắt đầu OWASP 20 scenarios trước khi E2E business ổn.

---

## 5. Việc dang dở ngoài M16/M17

- VNPay / GHN / SMTP credential thật
- Catalog consumer `review.rating-aggregate.updated`
- Identity publish `user.registered`
- Admin users/roles API
- Helm/K8s production
- OWASP 20 scenarios
