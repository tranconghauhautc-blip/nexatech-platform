# Handoff — Chuẩn bị M18

Tài liệu bàn giao cho Agent / developer phiên tiếp theo. **Không bắt đầu M19 (hoặc OWASP 20 scenarios) trước DoD M18.**

Ngày bàn giao: **2026-07-30**

---

## 1. Trạng thái repository sau M17

| Mục            | Giá trị                                                             |
| -------------- | ------------------------------------------------------------------- |
| Path           | `d:\NexaTech\nexatech-platform`                                     |
| Branch         | `main`                                                              |
| Milestone xong | M0–**M17** (Docker/Helm/Kubernetes packaging)                       |
| Milestone tiếp | **M18** — production readiness / observability / ops                |
| Feat commit    | M17 local (Helm 0.17.0, ADR-036) — chưa push nếu working tree local |
| Nx             | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`                       |
| Next.js        | **15.2.4**                                                          |
| Helm chart     | `deploy/helm/nexatech` **0.17.0**                                   |
| Image tag      | **0.17.0** (+ `${tag}-migrate` cho Prisma Jobs)                     |

### Projects

- 14 Nest backends (Dockerfiles, UID 10001, `enableShutdownHooks`)
- 2 Next.js apps (storefront-web, admin-web)
- Helm: apps + entry + platform + migrate Jobs
- Kong: `infra/kong/kong.yml` (local), `infra/kong/kong.production.yml` (VIP)
- Scripts: `scripts/docker-build-all.ps1`, `scripts/docker-build-all.sh`
- Docs: `docs/MIGRATIONS.md`, ADR-036, DEPLOYMENT.md cập nhật M17

---

## 2. M17 đã giao

### Docker / images

- Multi-stage Dockerfiles cho 16 apps; tag `0.17.0`
- Non-root UID **10001**; Nest `app.enableShutdownHooks()`
- `deploy/docker/prisma-migrate.Dockerfile` → image `<service>:<tag>-migrate`
- Build scripts PS/Bash: build all hoặc một image; optional push (**không** `docker login` trong script)

### Helm chart (`deploy/helm/nexatech` v0.17.0)

- Deployments + ClusterIP Services cho storefront, admin, 14 APIs
- Probes, securityContext, optional HPA/PDB
- **Entry:** nginx reverse-proxy + Service `LoadBalancer` + MetalLB VIP
- **Platform:** Redis, RabbitMQ, MinIO (+ bucket-init) — **ClusterIP only**
- **Migrate Jobs:** Helm hooks `pre-install,pre-upgrade`, `prisma migrate deploy`
- Values: `values.yaml`, `values-example.yaml`, `values-production.yaml`
- Secrets mẫu: `secret-values.example.yaml` (không giá trị thật)

### Kong / networking

- Production upstreams → MetalLB VIP **`192.168.4.204`** only
- Local + production routes: `/`, `/admin`, `/api/v1`, `/api/v2`
- Kong VM **`192.168.4.209`** — config declarative, không trong chart

### External Postgres

- Host **`192.168.4.208`** chỉ trong `values-production.yaml`
- 14 app DB users qua Secret keys `*-database-url`

### Validation (unattended)

| Kiểm tra                                     | Kết quả              |
| -------------------------------------------- | -------------------- |
| `pnpm format`                                | OK                   |
| `pnpm lint`                                  | OK                   |
| `pnpm test`                                  | OK                   |
| `pnpm build`                                 | OK                   |
| `helm lint` + `helm template`                | OK                   |
| Docker smoke (storefront, identity, migrate) | OK                   |
| Secret scan (no real creds in git)           | OK                   |
| `helm upgrade` / `kubectl apply` thật        | **BLOCKED_EXTERNAL** |

---

## 3. Phạm vi M18 (Definition of Done)

M18 biến packaging M17 thành **production-operable**. Không thêm business feature lớn; không cố ý tạo lỗ hổng OWASP.

### 3.1 Observability stack

- Prometheus (+ ServiceMonitor / PodMonitor cho Nest apps)
- Grafana dashboards (RED/USE, business KPIs cơ bản)
- Loki (log aggregation) + Promtail hoặc tương đương
- Tempo (distributed tracing) + OpenTelemetry Collector
- Helm subchart hoặc manifests riêng trong `deploy/` — document trong DEPLOYMENT.md

### 3.2 Application telemetry

- OpenTelemetry SDK/instrumentation Nest (HTTP, Prisma spans nếu khả thi)
- Structured logging correlation (`requestId`, `traceId`) export OTel
- Frontend: optional RUM/lightweight client trace ID propagation
- Config qua env — không hard-code collector URL production

### 3.3 Backup / restore runbooks

- PostgreSQL VM `.208`: pg_dump schedule, retention, restore drill
- Redis/RabbitMQ/MinIO PVC: snapshot hoặc native backup procedure
- Document tại `docs/BACKUP-RESTORE.md` (tạo mới)
- Test restore trên staging — không destructive trên prod unattended

### 3.4 Kubernetes ops runbooks

- `docs/K8S-OPS.md`: rollout, rollback, scale, PDB, node drain
- Migrate Job failure triage (mở rộng MIGRATIONS.md)
- Entry/VIP/Kong health check procedure
- Incident checklist (pod crash loop, OOM, DB connection exhaustion)

### 3.5 Security baseline

- NetworkPolicy enable path (template `networkpolicy-ready.yaml` → default on production values)
- Pod Security Standards / restricted defaults review
- Secret rotation procedure (JWT, DB passwords via operator)
- Container image scan note (Trivy/Grype script optional)
- RBAC least-privilege ServiceAccount — không cluster-admin cho app SA
- **Không** triển khai OWASP intentional vulns — OWASP 20 scenarios vẫn M21

### 3.6 Production validation scripts

- Script smoke post-deploy: health all services qua Kong/VIP
- Helm test hooks hoặc `scripts/validate-production.ps1|.sh`
- k6 smoke nhẹ against staging/VIP (optional credentials)

### 3.7 Deployment runbook — infra thật

Document step-by-step cho operator (agent unattended **không** chạy):

| Thành phần   | IP                  | Hành động M18 runbook                     |
| ------------ | ------------------- | ----------------------------------------- |
| PostgreSQL   | `192.168.4.208`     | DB/users/grants, backup agent, firewall   |
| K8s workers  | `192.168.4.205–207` | Join cluster, storage class, MetalLB pool |
| MetalLB VIP  | `192.168.4.204`     | Verify entry Service, nginx health        |
| Kong Gateway | `192.168.4.209`     | Apply `kong.production.yml`, TLS cert     |

Luồng deploy:

1. Build/push images (`docker login` + build scripts)
2. Tạo namespace + Secret `nexatech-secrets`
3. `helm upgrade --install` với `values-production.yaml`
4. Verify migrate Jobs succeeded
5. Apply Kong config trên VM `.209`
6. Run production validation scripts
7. Production-safe catalog seed (không dữ liệu dev/test nhạy cảm)

Lưu tại `docs/DEPLOY-RUNBOOK-PRODUCTION.md` (tạo mới trong M18).

### 3.8 Production-safe seed

- Script/idempotent seed chỉ chạy khi operator xác nhận env production
- Không ghi đè dữ liệu khách thật; flag `--dry-run` / `--confirm-production`
- Tách khỏi `pnpm seed:catalog` dev local

### 3.9 Docs / ADR

- Cập nhật ARCHITECTURE.md § observability
- ADR mới nếu chọn stack cụ thể (e.g. ADR-037 Observability)
- PROGRESS.md M18 checklist
- HANDOFF-M19 chỉ sau DoD M18

---

## 4. BLOCKED_EXTERNAL (agent không tự làm)

Các thao tác **bắt buộc operator** — agent unattended dừng tại dry-run/lint/template:

| Hạng mục                             | Lý do                       |
| ------------------------------------ | --------------------------- |
| `helm upgrade --install` lên cluster | Không verified kube-context |
| `kubectl apply` mutate production    | Rủi ro thay đổi live infra  |
| `docker push`                        | Cần Docker Hub credentials  |
| Kong apply trên VM `.209`            | SSH/credential ngoài repo   |
| PostgreSQL trên `.208`               | Credential + dữ liệu thật   |
| TLS certificate issuance             | Domain + CA operator        |
| MetalLB IP pool config trên cluster  | Infra-specific              |
| SMTP / VNPay / GHN / Google OAuth    | Secret thật user cung cấp   |
| Backup restore drill trên prod       | Destructive nếu sai         |

Agent M18 **được phép:** viết manifests/scripts/docs, `helm lint/template`, unit/integration test, local docker smoke, dry-run client-only.

---

## 5. Cách validate M18

### Trong repo (agent)

```powershell
$env:NX_SKIP_NATIVE_FILE_CACHE='true'
$env:NX_DAEMON='false'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='change-me-access-secret-min-32-chars'
$env:ADMIN_SESSION_SECRET='change-me-admin-session-secret-min-16'
pnpm format; pnpm lint; pnpm test; pnpm build
```

Helm observability additions:

```powershell
helm lint deploy/helm/nexatech
helm template nexatech deploy/helm/nexatech -f deploy/helm/nexatech/values-production.yaml
# + lint/template observability chart nếu tách riêng
```

### Với operator (staging/prod)

1. Deploy observability stack → Grafana reachable (ClusterIP port-forward hoặc ingress nội bộ)
2. Generate traffic → traces trong Tempo, logs trong Loki, metrics trong Prometheus
3. Chạy backup → restore trên DB test → verify row counts
4. `scripts/validate-production.*` all green qua Kong VIP
5. Rollback drill: `helm rollback` + verify health

### Definition of Done M18

- [ ] Observability stack deployable via Helm/docs
- [ ] Nest OTel instrumentation merged + config env
- [ ] BACKUP-RESTORE.md + K8S-OPS.md + DEPLOY-RUNBOOK-PRODUCTION.md
- [ ] Security baseline documented + NetworkPolicy path
- [ ] Production validation scripts pass on staging (operator)
- [ ] Production-safe seed script with guards
- [ ] format/lint/test/build pass
- [ ] PROGRESS.md + HANDOFF-M19
- [ ] **Không** bắt đầu M19 OWASP từ body handoff này

---

## 6. Việc dang dở ngoài M17/M18

- JWT guards thay `x-user-*` header (có thể M19+)
- Google OAuth, OTP email production
- VNPay / GHN / SMTP credential thật
- Catalog consumer `review.rating-aggregate.updated`
- Identity publish `user.registered`
- Admin users/roles API
- OWASP 20 scenarios (M21 roadmap)
- Patch Next.js CVE khi có window

---

## 7. Tài liệu tham chiếu M17

- `docs/DECISIONS.md` — ADR-036
- `docs/DEPLOYMENT.md` — Helm, Kong, MetalLB, secrets, migrate
- `docs/MIGRATIONS.md` — Prisma Job runbook
- `docs/ARCHITECTURE.md` — §11 Deployment
- `docs/TESTING.md` — M17 validation notes
- `deploy/helm/nexatech/` — chart source
