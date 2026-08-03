# Handoff â€” Chuáº©n bá»‹ M18

TÃ i liá»‡u bÃ n giao cho Agent / developer phiÃªn tiáº¿p theo. **KhÃ´ng báº¯t Ä‘áº§u M19 (hoáº·c OWASP 20 scenarios) trÆ°á»›c DoD M18.**

NgÃ y bÃ n giao: **2026-07-30**

---

## 1. Tráº¡ng thÃ¡i repository sau M17

| Má»¥c            | GiÃ¡ trá»‹                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| Path             | `d:\NexaTech\nexatech-platform`                                          |
| Branch           | `main`                                                                   |
| Milestone xong   | M0â€“**M17** (Docker/Helm/Kubernetes packaging)                          |
| Milestone tiáº¿p | **M18** â€” production readiness / observability / ops                   |
| Feat commit      | M17 local (Helm 0.17.0, ADR-036) â€” chÆ°a push náº¿u working tree local |
| Nx               | **22.7.7** + `NX_SKIP_NATIVE_FILE_CACHE=true`                            |
| Next.js          | **15.2.4**                                                               |
| Helm chart       | `deploy/helm/nexatech` **0.17.0**                                        |
| Image tag        | **0.17.0** (+ `${tag}-migrate` cho Prisma Jobs)                          |

### Projects

- 14 Nest backends (Dockerfiles, UID 10001, `enableShutdownHooks`)
- 2 Next.js apps (storefront-web, admin-web)
- Helm: apps + entry + platform + migrate Jobs
- Kong: `infra/kong/kong.yml` (local), `infra/kong/kong.production.yml` (VIP)
- Scripts: `scripts/docker-build-all.ps1`, `scripts/docker-build-all.sh`
- Docs: `docs/MIGRATIONS.md`, ADR-036, DEPLOYMENT.md cáº­p nháº­t M17

---

## 2. M17 Ä‘Ã£ giao

### Docker / images

- Multi-stage Dockerfiles cho 16 apps; tag `0.17.0`
- Non-root UID **10001**; Nest `app.enableShutdownHooks()`
- `deploy/docker/prisma-migrate.Dockerfile` â†’ image `<service>:<tag>-migrate`
- Build scripts PS/Bash: build all hoáº·c má»™t image; optional push (**khÃ´ng** `docker login` trong script)

### Helm chart (`deploy/helm/nexatech` v0.17.0)

- Deployments + ClusterIP Services cho storefront, admin, 14 APIs
- Probes, securityContext, optional HPA/PDB
- **Entry:** nginx reverse-proxy + Service `LoadBalancer` + MetalLB VIP
- **Platform:** Redis, RabbitMQ, MinIO (+ bucket-init) â€” **ClusterIP only**
- **Migrate Jobs:** Helm hooks `pre-install,pre-upgrade`, `prisma migrate deploy`
- Values: `values.yaml`, `values-example.yaml`, `values-production.yaml`
- Secrets máº«u: `secret-values.example.yaml` (khÃ´ng giÃ¡ trá»‹ tháº­t)

### Kong / networking

- Production upstreams â†’ MetalLB VIP **`192.168.4.204`** only
- Local + production routes: `/`, `/admin`, `/api/v1`, `/api/v2`
- Kong VM **`192.168.4.209`** â€” config declarative, khÃ´ng trong chart

### External Postgres

- Host **`192.168.4.208`** chá»‰ trong `values-production.yaml`
- 14 app DB users qua Secret keys `*-database-url`

### Validation (unattended)

| Kiá»ƒm tra                                   | Káº¿t quáº£          |
| -------------------------------------------- | -------------------- |
| `pnpm format`                                | OK                   |
| `pnpm lint`                                  | OK                   |
| `pnpm test`                                  | OK                   |
| `pnpm build`                                 | OK                   |
| `helm lint` + `helm template`                | OK                   |
| Docker smoke (storefront, identity, migrate) | OK                   |
| Secret scan (no real creds in git)           | OK                   |
| `helm upgrade` / `kubectl apply` tháº­t      | **BLOCKED_EXTERNAL** |

---

## 3. Pháº¡m vi M18 (Definition of Done)

M18 biáº¿n packaging M17 thÃ nh **production-operable**. KhÃ´ng thÃªm business feature lá»›n; khÃ´ng cá»‘ Ã½ táº¡o lá»— há»•ng OWASP.

### 3.1 Observability stack

- Prometheus (+ ServiceMonitor / PodMonitor cho Nest apps)
- Grafana dashboards (RED/USE, business KPIs cÆ¡ báº£n)
- Loki (log aggregation) + Promtail hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng
- Tempo (distributed tracing) + OpenTelemetry Collector
- Helm subchart hoáº·c manifests riÃªng trong `deploy/` â€” document trong DEPLOYMENT.md

### 3.2 Application telemetry

- OpenTelemetry SDK/instrumentation Nest (HTTP, Prisma spans náº¿u kháº£ thi)
- Structured logging correlation (`requestId`, `traceId`) export OTel
- Frontend: optional RUM/lightweight client trace ID propagation
- Config qua env â€” khÃ´ng hard-code collector URL production

### 3.3 Backup / restore runbooks

- PostgreSQL VM `.208`: pg_dump schedule, retention, restore drill
- Redis/RabbitMQ/MinIO PVC: snapshot hoáº·c native backup procedure
- Document táº¡i `docs/BACKUP-RESTORE.md` (táº¡o má»›i)
- Test restore trÃªn staging â€” khÃ´ng destructive trÃªn prod unattended

### 3.4 Kubernetes ops runbooks

- `docs/K8S-OPS.md`: rollout, rollback, scale, PDB, node drain
- Migrate Job failure triage (má»Ÿ rá»™ng MIGRATIONS.md)
- Entry/VIP/Kong health check procedure
- Incident checklist (pod crash loop, OOM, DB connection exhaustion)

### 3.5 Security baseline

- NetworkPolicy enable path (template `networkpolicy-ready.yaml` â†’ default on production values)
- Pod Security Standards / restricted defaults review
- Secret rotation procedure (JWT, DB passwords via operator)
- Container image scan note (Trivy/Grype script optional)
- RBAC least-privilege ServiceAccount â€” khÃ´ng cluster-admin cho app SA
- **KhÃ´ng** triá»ƒn khai OWASP intentional vulns â€” OWASP 20 scenarios váº«n M21

### 3.6 Production validation scripts

- Script smoke post-deploy: health all services qua Kong/VIP
- Helm test hooks hoáº·c `scripts/validate-production.ps1|.sh`
- k6 smoke nháº¹ against staging/VIP (optional credentials)

### 3.7 Deployment runbook â€” infra tháº­t

Document step-by-step cho operator (agent unattended **khÃ´ng** cháº¡y):

| ThÃ nh pháº§n | IP                    | HÃ nh Ä‘á»™ng M18 runbook                |
| ------------- | --------------------- | ----------------------------------------- |
| PostgreSQL    | `192.168.4.208`       | DB/users/grants, backup agent, firewall   |
| K8s workers   | `192.168.4.205â€“207` | Join cluster, storage class, MetalLB pool |
| MetalLB VIP   | `192.168.4.204`       | Verify entry Service, nginx health        |
| Kong Gateway  | `192.168.4.209`       | Apply `kong.production.yml`, TLS cert     |

Luá»“ng deploy:

1. Build/push images (`docker login` + build scripts)
2. Táº¡o namespace + Secret `nexatech-secrets`
3. `helm upgrade --install` vá»›i `values-production.yaml`
4. Verify migrate Jobs succeeded
5. Apply Kong config trÃªn VM `.209`
6. Run production validation scripts
7. Production-safe catalog seed (khÃ´ng dá»¯ liá»‡u dev/test nháº¡y cáº£m)

LÆ°u táº¡i `docs/DEPLOY-RUNBOOK-PRODUCTION.md` (táº¡o má»›i trong M18).

### 3.8 Production-safe seed

- Script/idempotent seed chá»‰ cháº¡y khi operator xÃ¡c nháº­n env production
- KhÃ´ng ghi Ä‘Ã¨ dá»¯ liá»‡u khÃ¡ch tháº­t; flag `--dry-run` / `--confirm-production`
- TÃ¡ch khá»i `pnpm seed:catalog` dev local

### 3.9 Docs / ADR

- Cáº­p nháº­t ARCHITECTURE.md Â§ observability
- ADR má»›i náº¿u chá»n stack cá»¥ thá»ƒ (e.g. ADR-037 Observability)
- PROGRESS.md M18 checklist
- HANDOFF-M19 chá»‰ sau DoD M18

---

## 4. BLOCKED_EXTERNAL (agent khÃ´ng tá»± lÃ m)

CÃ¡c thao tÃ¡c **báº¯t buá»™c operator** â€” agent unattended dá»«ng táº¡i dry-run/lint/template:

| Háº¡ng má»¥c                          | LÃ½ do                          |
| ------------------------------------- | ------------------------------- |
| `helm upgrade --install` lÃªn cluster | KhÃ´ng verified kube-context    |
| `kubectl apply` mutate production     | Rá»§i ro thay Ä‘á»•i live infra |
| `docker push`                         | Cáº§n Docker Hub credentials    |
| Kong apply trÃªn VM `.209`            | SSH/credential ngoÃ i repo      |
| PostgreSQL trÃªn `.208`               | Credential + dá»¯ liá»‡u tháº­t |
| TLS certificate issuance              | Domain + CA operator            |
| MetalLB IP pool config trÃªn cluster  | Infra-specific                  |
| SMTP / VNPay / GHN / Google OAuth     | Secret tháº­t user cung cáº¥p   |
| Backup restore drill trÃªn prod       | Destructive náº¿u sai           |

Agent M18 **Ä‘Æ°á»£c phÃ©p:** viáº¿t manifests/scripts/docs, `helm lint/template`, unit/integration test, local docker smoke, dry-run client-only.

---

## 5. CÃ¡ch validate M18

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
# + lint/template observability chart náº¿u tÃ¡ch riÃªng
```

### Vá»›i operator (staging/prod)

1. Deploy observability stack â†’ Grafana reachable (ClusterIP port-forward hoáº·c ingress ná»™i bá»™)
2. Generate traffic â†’ traces trong Tempo, logs trong Loki, metrics trong Prometheus
3. Cháº¡y backup â†’ restore trÃªn DB test â†’ verify row counts
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
- [ ] **KhÃ´ng** báº¯t Ä‘áº§u M19 OWASP tá»« body handoff nÃ y

---

## 6. Viá»‡c dang dá»Ÿ ngoÃ i M17/M18

- JWT guards thay `x-user-*` header (cÃ³ thá»ƒ M19+)
- Google OAuth, OTP email production
- VNPay / GHN / SMTP credential tháº­t
- Catalog consumer `review.rating-aggregate.updated`
- Identity publish `user.registered`
- Admin users/roles API
- OWASP 20 scenarios (M21 roadmap)
- Patch Next.js CVE khi cÃ³ window

---

## 7. TÃ i liá»‡u tham chiáº¿u M17

- `docs/DECISIONS.md` â€” ADR-036
- `docs/DEPLOYMENT.md` â€” Helm, Kong, MetalLB, secrets, migrate
- `docs/MIGRATIONS.md` â€” Prisma Job runbook
- `docs/ARCHITECTURE.md` â€” Â§11 Deployment
- `docs/TESTING.md` â€” M17 validation notes
- `deploy/helm/nexatech/` â€” chart source
