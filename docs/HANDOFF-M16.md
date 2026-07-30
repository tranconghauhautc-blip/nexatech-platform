# Handoff — Chuẩn bị M16

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M16 trước DoD M15.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                                         |
| -------------- | --------------------------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                                 |
| Branch         | `main`                                                          |
| Milestone xong | M0–**M15** (storefront-web + admin-web)                         |
| Milestone tiếp | **M16** — xem roadmap (Docker images từng backend / Kong / E2E) |
| Feat commit    | `2105088`                                                       |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`                   |
| Next.js        | **15.2.4** (pin M15; cân nhắc patch CVE khi nâng trong patch)   |

### Projects Nx (sau M15)

- Libs: 8 shared (+ `shared-web`)
- Apps: 14 Nest services + `storefront-web` + `admin-web`

---

## 2. M15 đã giao

### storefront-web (port 3000)

- App Router tiếng Việt, VND, layout header/footer, SEO metadata/OG/sitemap/robots
- Home, danh mục, tìm kiếm, PDP, giỏ hàng, checkout, auth UI, tài khoản
- BFF `/api/bff/{service}` + `/api/auth/*`; session httpOnly; merge cart sau login
- Không voucher/flash sale

### admin-web (port 3100)

- Login Staff+; RBAC menu; dashboard reporting; list modules catalog→reporting
- Users stub (API chưa có); `robots` disallow all
- Signed admin session cookie

### Shared / Docker

- `libs/shared/web`
- Dockerfile standalone storefront + admin
- ADR-034

---

## 3. Cách chạy kiểm tra

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='change-me-access-secret-min-32-chars'
$env:ADMIN_SESSION_SECRET='change-me-admin-session-secret-min-16'
pnpm format; pnpm lint; pnpm test; pnpm build
pnpm exec nx dev storefront-web
pnpm exec nx dev admin-web
```

---

## 4. Gợi ý phạm vi M16 (dự kiến)

- Dockerfile production cho từng backend service + compose app stack
- Kong Gateway routes `/api/v1` thống nhất
- Playwright E2E smoke storefront/admin đầy đủ
- Seed ~100 sản phẩm + wire Prisma identity/customer nếu còn in-memory
- Patch Next.js CVE nếu cần nâng 15.x

**Không** bắt đầu OWASP 20 scenarios trước khi business E2E ổn.

---

## 5. Việc dang dở ngoài M15/M16

- Google OAuth, JWT guards thay header giả lập
- VNPay / GHN / SMTP credential thật
- Catalog consumer `review.rating-aggregate.updated`
- Identity publish `user.registered` / OTP email qua notification
- Helm/K8s production
- OWASP 20 scenarios
