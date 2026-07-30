# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** M20 — Performance / reliability / disaster recovery
- **Milestone đã hoàn thành gần nhất:** M19 (deployment preflight / release readiness)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **HEAD baseline trước M20:** `2fad006` (docs hash follow-up)
- **Kiểm tra DoD M20:** k6 scenarios, resilience/DR docs, SLI/SLO, alerts static, backup dry-run, format/lint/test/build/e2e

## Roadmap milestone

| ID     | Milestone                                        | Trạng thái     | Ghi chú               |
| ------ | ------------------------------------------------ | -------------- | --------------------- |
| M0–M19 | …                                                | ✅ Done        | M19 feat `2fad006`    |
| M20    | Performance / reliability / DR                   | 🔄 In progress | ADR-039               |
| M21    | Security lab / OWASP intentional vulnerabilities | ⏳ Pending     | Sau DoD M20           |

## Commits

| Commit    | Nội dung                        |
| --------- | ------------------------------- |
| `2fad006` | M19 preflight/release readiness |
| _(TBD)_   | M19 docs hash                   |
| _(TBD)_   | M20 performance/reliability/DR  |

## M20 checklist (In progress)

- [ ] k6 performance scenarios + thresholds
- [ ] Resilience test plans / failure-mode expectations
- [ ] Backup/restore validation (isolated / dry-run)
- [ ] DR RPO/RTO draft
- [ ] SLI/SLO draft
- [ ] Alert readiness (static rules/docs)
- [ ] Incident / performance / resilience / DR runbooks
- [ ] Validation pipeline
- [ ] Docs + ADR-039 + HANDOFF-M21
- [ ] Feature commit + docs hash

## BLOCKED_EXTERNAL

- helm upgrade / kubectl apply cluster thật
- docker push
- Kong apply VM `.209`
- Live chaos / pod kill trên cluster thật
- Restore vào DB production
- Citrix ADC / Imperva

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
Next.js **15.2.4**.

## Nhật ký

### 2026-07-30 — M20 started

- Baseline after M19 feature `2fad006`.
- Scope: k6, resilience, DR, SLI/SLO, alerts, incident docs.
- **Không** bắt đầu OWASP lab (M21).

### 2026-07-30 — M19 done

- Feat `2fad006`. Preflight/smoke/image matrix/release checklist.
