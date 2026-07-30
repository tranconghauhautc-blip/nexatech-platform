# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(sẵn sàng M20 — M19 hoàn tất)_
- **Milestone đã hoàn thành gần nhất:** M19 (deployment preflight / release readiness)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra DoD M19:** format / lint / test / build / e2e; helm lint/template; Docker smoke; preflight/smoke dry-run; secret-leak

## Roadmap milestone

| ID     | Milestone                                        | Trạng thái | Ghi chú                   |
| ------ | ------------------------------------------------ | ---------- | ------------------------- |
| M0–M16 | …                                                | ✅ Done    | Xem lịch sử               |
| M17    | Docker/Helm/Kubernetes packaging                 | ✅ Done    | ADR-036, `3e2c830`        |
| M18    | Production readiness / observability / ops       | ✅ Done    | ADR-037, `d904b12`        |
| M19    | Deployment preflight / release readiness         | ✅ Done    | ADR-038                   |
| M20    | Performance / reliability / DR                   | ⏳ Pending | `docs/HANDOFF-M20.md`     |
| M21    | Security lab / OWASP intentional vulnerabilities | ⏳ Pending | Sau DoD M20               |

## Commits

| Commit    | Nội dung                        |
| --------- | ------------------------------- |
| `d904b12` | M18 observability/ops           |
| `722aff9` | M18 docs hash                   |
| `ced01fc` | M18 secret-leak scan fix        |
| _(TBD)_   | M19 preflight/release readiness |

## M19 checklist (Done)

- [x] Production preflight scripts (PS1 + Bash)
- [x] Image matrix (docs + `image-matrix.json`)
- [x] Deployment order documentation
- [x] Migration orchestration standardization
- [x] Seed sequencing documentation
- [x] Kong / MetalLB static validation
- [x] Smoke test scripts (PS1 + Bash)
- [x] Release checklist
- [x] Validation pipeline
- [x] Docs + ADR-038 + HANDOFF-M20
- [ ] Feature commit + docs hash commit _(in progress)_

## BLOCKED_EXTERNAL

- helm upgrade / kubectl apply cluster thật
- docker push (cần Docker Hub login)
- Kong apply VM `.209`, Postgres mutate `.208`
- Citrix ADC / Imperva
- Restore drill trên DB production
- Live MetalLB/kube-context verification trên cluster thật

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
Next.js **15.2.4**.
Helm local: `.tools/bin/helm.exe` (gitignored).

## Nhật ký

### 2026-07-30 — M19 done

- Preflight/smoke scripts; image matrix; deployment order; release checklist; migration docs; ADR-038; HANDOFF-M20.
- Validation: format/lint/test/build/e2e; helm lint/template; Docker smoke identity+storefront+migrate; secret-leak clean.
- **Không** bắt đầu M20/M21 trong commit feature M19.

### 2026-07-30 — M18 done

- Observability chart 0.18.0; ops/backup/security docs; scripts; NetworkPolicy production.
