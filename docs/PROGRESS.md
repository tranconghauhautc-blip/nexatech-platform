# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(sẵn sàng M19 — chưa bắt đầu)_
- **Milestone đã hoàn thành gần nhất:** M18 (production readiness / observability / ops)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra DoD M18:** format / lint / test / build; helm lint/template apps+obs; scripts dry-run; BLOCKED_EXTERNAL cho cluster thật

## Roadmap milestone

| ID      | Milestone                                  | Trạng thái | Ghi chú                      |
| ------- | ------------------------------------------ | ---------- | ---------------------------- |
| M0–M16  | …                                          | ✅ Done    | Xem lịch sử bên dưới         |
| M17     | Docker/Helm/Kubernetes packaging           | ✅ Done    | ADR-036, commit `3e2c830`    |
| M18     | Production readiness / observability / ops | ✅ Done    | ADR-037                      |
| M19–M22 | …                                          | ⏳ Pending | Sau DoD M18; xem HANDOFF-M19 |

## Commits

| Commit    | Nội dung              |
| --------- | --------------------- |
| `042d846` | M16 Docker/Kong/E2E   |
| `9bb34ef` | M16 docs hash         |
| `6e0cb8a` | M16 HANDOFF hash      |
| `3e2c830` | M17 Helm/Docker/K8s   |
| `d3bae87` | M17 docs hash         |
| _(local)_ | M18 observability/ops |

## M18 checklist (Done)

- [x] Observability Helm chart (Prometheus/Grafana/Loki/Promtail/Tempo/OTel)
- [x] App telemetry: log redaction, LOG_LEVEL, OTEL env wiring
- [x] Backup/restore runbook + dry-run scripts
- [x] K8s ops + production deploy runbook
- [x] Security baseline + NetworkPolicy production path
- [x] validate-production + secret-leak scripts
- [x] Production-safe catalog seed wrapper
- [x] Docs + ADR-037 + HANDOFF-M19
- [x] **Không bắt đầu M19**

## BLOCKED_EXTERNAL

- helm upgrade / kubectl apply cluster thật (kube-context chưa verified trong phiên unattended)
- docker push (cần Docker Hub login)
- Kong apply VM `.209`, Postgres mutate `.208`
- Citrix ADC / Imperva
- Restore drill trên DB production

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
Next.js **15.2.4**.
Helm local: `.tools/bin/helm.exe` (gitignored).

## Nhật ký

### 2026-07-30 — M18 done

- Observability chart 0.18.0; ops/backup/security docs; scripts; shared-logging redaction; NetworkPolicy production.
- HANDOFF-M19 sẵn sàng; **không bắt đầu M19**.

### 2026-07-30 — M17 done

- Commit `3e2c830` / docs `d3bae87`. Helm 0.17.0, MetalLB entry, Kong VIP, migrate Jobs.
