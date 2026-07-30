# NexaTech Progress

## Tráº¡ng thÃ¡i hiá»‡n táº¡i

- **Milestone Ä‘ang lÃ m:** M18 â€” Production readiness / observability / ops
- **Milestone Ä‘Ã£ hoÃ n thÃ nh gáº§n nháº¥t:** M17 (Docker/Helm/Kubernetes packaging)
- **Cáº­p nháº­t láº§n cuá»‘i:** 2026-07-30
- **Branch:** `main`
- **Kiá»ƒm tra DoD M17:** format / lint / test / build OK; helm lint/template OK; docker smoke OK; kubectl dry-run BLOCKED_EXTERNAL

## Roadmap milestone

| ID      | Milestone                                  | Tráº¡ng thÃ¡i | Ghi chÃº                          |
| ------- | ------------------------------------------ | ---------- | -------------------------------- |
| M0      | Kiá»ƒm tra mÃ´i trÆ°á»ng vÃ  thiáº¿t káº¿ kiáº¿n trÃºc  | âœ… Done    | Docs + env check                 |
| M1      | Khá»Ÿi táº¡o Nx monorepo                       | âœ… Done    | Nx **22.7.7** + TS strict + Jest |
| M2      | Shared libraries vÃ  chuáº©n ná»n táº£ng         | âœ… Done    | 7 shared libs                    |
| M3      | Identity vÃ  customer                       | âœ… Done    | Auth flows + customer profile    |
| M4      | Catalog, search vÃ  media                   | âœ… Done    | Prisma + FTS + MinIO             |
| M5      | Inventory                                  | âœ… Done    | warehouse/store/stock + RabbitMQ |
| M6      | Cart                                       | âœ… Done    | guest/user merge + Redis         |
| M7      | Order / Checkout                           | âœ… Done    | order-service + outbox           |
| M8      | Payment                                    | âœ… Done    | payment-service + VNPay/MOCK/COD |
| M9      | Shipping                                   | âœ… Done    | shipping-service + mock/GHN      |
| M10     | Review                                     | âœ… Done    | review-service                   |
| M11     | Warranty                                   | âœ… Done    | warranty-service                 |
| M12     | Support                                    | âœ… Done    | support-service                  |
| M13     | Notification                               | âœ… Done    | notification-service             |
| M14     | Reporting                                  | âœ… Done    | reporting-service                |
| M15     | Frontend storefront + admin                | âœ… Done    | Next.js 15 App Router            |
| M16     | Docker/Kong/E2E/seed                       | âœ… Done    | ADR-035                          |
| M17     | Docker/Helm/Kubernetes packaging           | âœ… Done    | ADR-036, Helm 0.17.0             |
| M18     | Production readiness / observability / ops | â³ Pending | Xem `docs/HANDOFF-M18.md`        |
| M19â€“M22 | â€¦                                          | â³ Pending | Sau M18                          |

## Commits

| Commit    | Ná»™i dung                 |
| --------- | ------------------------ |
| `8526147` | M4 catalog + media       |
| `b38b723` | M5 inventory-service     |
| `d2155fc` | M6 cart-service          |
| `4e2627a` | M7 order-service         |
| `1245aff` | M8 payment-service       |
| `882320f` | M9 shipping-service      |
| `7c1a582` | M12 support-service      |
| `b353d67` | M13 notification-service |
| `8f86457` | M14 reporting-service    |
| `2105088` | M15 storefront + admin   |
| `811075a` | M15 docs hash            |
| `042d846` | M16 Docker/Kong/E2E      |
| `9bb34ef` | M16 docs hash            |
| `6e0cb8a` | M16 HANDOFF hash         |
| `3e2c830` | M17 Helm/Docker/K8s        |

## M17 checklist (Done)

- [x] Docker build/push scripts (PS + Bash), tag version/SHA
- [x] Chuáº©n hÃ³a image frontend/backend (multi-stage, non-root UID 10001, no secret)
- [x] Helm chart `deploy/helm/nexatech` v0.17.0
- [x] Workloads: Deployment/Service/probes/securityContext
- [x] Prisma migrate Jobs (`${tag}-migrate`, pre-install/pre-upgrade hooks)
- [x] External PostgreSQL values (host `192.168.4.208` in values-production only)
- [x] Platform: Redis, RabbitMQ, MinIO (+ bucket-init), ClusterIP only
- [x] MetalLB entry VIP `192.168.4.204` via nginx entry + LoadBalancer
- [x] Kong production upstream VIP + local/production routes `/`, `/admin`, APIs
- [x] Secret/config examples (`secret-values.example.yaml`, no real secrets in git)
- [x] Nest `enableShutdownHooks()` all backends
- [x] Validation: format/lint/test/build OK; helm lint/template OK; docker smoke (storefront + identity + migrate)
- [x] kubectl apply/helm upgrade tháº­t: BLOCKED_EXTERNAL (no verified kube-context)
- [x] Docs + HANDOFF-M18

## M18 preview (chÆ°a báº¯t Ä‘áº§u)

- Observability stack (Prometheus/Grafana/Loki/Tempo/OTel)
- App telemetry instrumentation
- Backup/restore + K8s ops runbooks
- Security baseline + production validation scripts
- Deploy runbook infra tháº­t (`.208/.209/.205â€“.207/.204`)
- Production-safe seed
- **KhÃ´ng** báº¯t Ä‘áº§u M19/OWASP tá»« HANDOFF-M18

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
Next.js **15.2.4**.
Helm CLI local: `.tools/bin/helm.exe` (optional; `helm` on PATH cÅ©ng Ä‘Æ°á»£c).

## Nháº­t kÃ½

### 2026-07-30 â€” M17 done

- Helm chart `deploy/helm/nexatech` 0.17.0: apps, entry/MetalLB, platform, migrate Jobs, HPA/PDB templates.
- Docker build scripts PS/Bash; migrate Dockerfile; image tag 0.17.0; non-root 10001; shutdown hooks.
- Kong `kong.production.yml` upstream VIP `.204`; local `kong.yml` `/` + `/admin`.
- `values-production.yaml`: Postgres `.208`, VIP `.204`; `secret-values.example.yaml`.
- Validation: format/lint/test/build pass; helm lint/template pass; docker smoke storefront+identity+migrate; secret scan clean.
- Deploy tháº­t: BLOCKED_EXTERNAL â€” chuáº©n bá»‹ M18 runbook.

### 2026-07-30 â€” M17 start

- Working tree sau M16; pháº¡m vi Docker/Helm/K8s packaging.
- ADR-036; docs/MIGRATIONS.md.

### 2026-07-30 â€” M16 done

- Docker backends + Kong + Playwright + catalog seed + identity/customer Prisma.
- Commit `042d846` / docs `9bb34ef` / `6e0cb8a`.
