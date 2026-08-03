# Handoff — Chuẩn bị M21

Tài liệu bàn giao sau **M20**. M21 là **security lab** với intentional vulnerabilities — tách biệt production.

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository

| Mục            | Giá trị                                     |
| -------------- | ------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`             |
| Branch         | `main`                                      |
| Milestone xong | M0–**M20**                                  |
| Milestone tiếp | **M21** — Security lab / OWASP              |
| Feat M19       | `2fad006` (docs `f202367`)                  |
| Feat M20       | `53247e4`                                   |
| Feat M21       | `20e98bb`                                   |
| Nx / Next.js   | **22.7.7** / **15.2.4**                     |
| Image tag      | **0.17.0** (prod); **0.21.0-sec-lab** (lab) |

---

## 2. M20 đã giao

- k6 scenarios `tests/k6/*` + helpers + private target guard
- `scripts/k6-validate.*`, `resilience-dry-run.*`, `backup-restore-validate.*`, `validate-alerts.*`
- Docs: PERFORMANCE-TESTING, RESILIENCE-TESTING, SLO-SLI, DISASTER-RECOVERY, INCIDENT-RESPONSE
- Alert drafts: `deploy/observability/alerts/nexatech-alerts.yaml`
- ADR-039

### BLOCKED_EXTERNAL

- Live chaos on real cluster
- Restore to production DB
- helm/kubectl mutate
- Citrix / Imperva
- docker push

---

## 3. Phạm vi M21 (bắt buộc)

1. Hai profile Helm: `values-production.yaml` (an toàn) + `values-security-lab.yaml` (lab only)
2. Image tags riêng `0.21.0-sec-lab` (hoặc tương đương) — **không** bật lab qua HTTP header/cookie
3. Namespace `nexatech-security-lab`, DB/Redis/RMQ/MinIO tách
4. ≥20 intentional vulnerabilities thật + PoC + secure regression
5. Lab marker endpoint; PoC yêu cầu `SECURITY_LAB_ACK`
6. Docs: OWASP-SCENARIOS, SECURITY-LAB-\*, FINAL-HANDOFF, DEPLOYMENT-CHECKLIST, KNOWN-LIMITATIONS
7. Commands: `pnpm security:test:secure|lab`, `security:smoke`, `security:validate`

**Cấm:** weaken production path để test lab xanh; backdoor ẩn; secret thật; public lab.

---

## 4. Validate baseline trước M21

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'; $env:NX_DAEMON='false'
$env:PATH = "$PWD\.tools\bin;$env:PATH"
pnpm format; pnpm lint; pnpm test; pnpm build; pnpm e2e
.\scripts\k6-validate.ps1
.\scripts\resilience-dry-run.ps1
.\scripts\backup-restore-validate.ps1
.\scripts\validate-alerts.ps1
.\scripts\check-secret-leak.ps1
```
