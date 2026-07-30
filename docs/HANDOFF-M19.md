# Handoff — Chuẩn bị M19

Tài liệu bàn giao sau **M18**. **Không bắt đầu OWASP 20 scenarios (M21) trước khi business E2E và auth production ổn.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                               |
| -------------- | ----------------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                       |
| Branch         | `main`                                                |
| Milestone xong | M0–**M18**                                            |
| Milestone tiếp | **M19** — auth hardening / E2E sâu / Next CVE (gợi ý) |
| Feat M17       | `3e2c830` (docs `d3bae87`)                            |
| Feat M18       | `d904b12` (docs `722aff9`)                            |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`         |
| Next.js        | **15.2.4**                                            |
| Helm apps      | `deploy/helm/nexatech` **0.17.0**                     |
| Helm obs       | `deploy/helm/nexatech-observability` **0.18.0**       |

---

## 2. M18 đã giao

- Observability Helm chart (Prometheus/Grafana/Loki/Promtail/Tempo/OTel Collector) — ClusterIP only
- App scrape annotations + OTEL env wiring; log redaction trong `shared-logging`
- Backup/restore, K8s ops, production deploy runbook, security baseline docs
- Scripts: validate-production, backup-postgres, seed-catalog-production, check-secret-leak
- NetworkPolicy production path enabled in values-production
- ADR-037

### BLOCKED_EXTERNAL (vẫn đúng)

- `helm upgrade` / `kubectl apply` cluster thật
- `docker push` (cần Docker Hub login)
- Kong apply trên VM `.209`
- Postgres backup/restore trên `.208` với dữ liệu thật
- Citrix ADC / Imperva cấu hình

---

## 3. Gợi ý phạm vi M19

Ưu tiên business/auth trước OWASP:

1. Wire JWT guards thay `x-user-*` header giả lập (edge Kong JWT + service verify)
2. Google OAuth thật + OTP email qua notification (khi có credential)
3. Mở rộng Playwright: login → cart merge → checkout MOCK end-to-end với Compose
4. Patch Next.js 15.x CVE nếu cửa sổ cho phép (không nâng Nx)
5. Optional: full OpenTelemetry Nest SDK nếu cần traces sâu hơn env-only

**Không** bắt đầu OWASP 20 scenarios trước khi E2E business ổn.

---

## 4. Cách validate baseline

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='change-me-access-secret-min-32-chars'
$env:ADMIN_SESSION_SECRET='change-me-admin-session-secret-min-16'
pnpm format; pnpm lint; pnpm test; pnpm build
$env:PATH = "$PWD\.tools\bin;$env:PATH"
helm lint deploy/helm/nexatech
helm lint deploy/helm/nexatech-observability
.\scripts\validate-production.ps1
.\scripts\check-secret-leak.ps1
```

---

## 5. Tài liệu tham chiếu

- `docs/DEPLOY-RUNBOOK-PRODUCTION.md`
- `docs/BACKUP-RESTORE.md`
- `docs/K8S-OPS.md`
- `docs/SECURITY-BASELINE.md`
- `docs/DECISIONS.md` — ADR-036, ADR-037
- `docs/HANDOFF-M18.md` — DoD M18 chi tiết
