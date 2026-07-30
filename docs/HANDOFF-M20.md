# Handoff — Chuẩn bị M20

Tài liệu bàn giao sau **M19**. **Không bắt đầu OWASP security lab (M21) trước khi M20 performance/DR xanh.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                         |
| -------------- | ----------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                 |
| Branch         | `main`                                          |
| Milestone xong | M0–**M19**                                      |
| Milestone tiếp | **M20** — Performance / reliability / DR        |
| Feat M18       | `d904b12` (docs `722aff9`)                      |
| Feat M19       | `2fad006`                                       |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`   |
| Next.js        | **15.2.4**                                      |
| Helm apps      | `deploy/helm/nexatech` **0.17.0**               |
| Helm obs       | `deploy/helm/nexatech-observability` **0.18.0** |
| Image tag      | **0.17.0** / **0.17.0-migrate** (never latest)  |

---

## 2. M19 đã giao

- Preflight: `scripts/deploy-preflight.ps1|.sh` (PASS/WARN/BLOCKED/FAIL, dry-run, no mutate, no secret print)
- Smoke: `scripts/smoke-release.ps1|.sh` (private target guard)
- Image matrix: `docs/IMAGE-MATRIX.md` + `docs/image-matrix.json`
- Deployment order: `docs/DEPLOYMENT-ORDER.md`
- Release checklist: `docs/RELEASE-CHECKLIST.md`
- Migration orchestration updates: `docs/MIGRATIONS.md`
- ADR-038

### Validation đã chạy (M19)

- format / lint / test / build / e2e
- helm lint + template apps + observability production
- Docker smoke: identity, storefront, identity-migrate
- deploy-preflight -DryRun -SkipKube -SkipConnectivity
- smoke-release -DryRun
- check-secret-leak

### BLOCKED_EXTERNAL (vẫn đúng)

- `helm upgrade` / `kubectl apply` cluster thật
- `docker push` (cần Docker Hub login)
- Kong apply trên VM `.209`
- Postgres backup/restore trên `.208` với dữ liệu thật
- Citrix ADC / Imperva
- Live MetalLB/kube verification từ mạng production

---

## 3. Phạm vi M20 (bắt buộc)

1. k6 scenarios dưới `tests/k6/` (browse, catalog, search, PDP, cart, checkout mock, payment mock, admin reporting read, notification inbox, mixed)
2. Thresholds lab (p95/p99, error rate) — ghi giả định rõ
3. Resilience test plans + failure-mode expectations (docs + dry-run scripts; **không** phá cluster thật)
4. Backup/restore validation (isolated only)
5. DR RPO/RTO draft
6. SLI/SLO draft + alert readiness
7. Incident / performance / resilience / DR docs
8. ADR-039 + HANDOFF-M21

**Không** bắt đầu intentional OWASP vulnerabilities trong M20.

---

## 4. Cách validate baseline trước M20

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='change-me-access-secret-min-32-chars'
$env:ADMIN_SESSION_SECRET='change-me-admin-session-secret-min-16'
$env:PATH = "$PWD\.tools\bin;$env:PATH"
pnpm format; pnpm lint; pnpm test; pnpm build; pnpm e2e
helm lint deploy/helm/nexatech
helm lint deploy/helm/nexatech-observability
.\scripts\deploy-preflight.ps1 -DryRun -SkipKube -SkipConnectivity
.\scripts\smoke-release.ps1 -DryRun -BaseUrl http://127.0.0.1
.\scripts\check-secret-leak.ps1
```

---

## 5. Tài liệu tham chiếu

- `docs/RELEASE-CHECKLIST.md`
- `docs/IMAGE-MATRIX.md`
- `docs/DEPLOYMENT-ORDER.md`
- `docs/BACKUP-RESTORE.md`
- `docs/K8S-OPS.md`
- `docs/DECISIONS.md` — ADR-038
- `docs/TESTING.md`
