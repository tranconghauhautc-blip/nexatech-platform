# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(sẵn sàng M21 — M20 hoàn tất)_
- **Milestone đã hoàn thành gần nhất:** M20 (performance / reliability / DR)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra DoD M20:** k6 assets + validate; resilience/backup/alerts dry-run; format/lint/test/build/e2e; secret-leak

## Roadmap milestone

| ID     | Milestone                                        | Trạng thái | Ghi chú               |
| ------ | ------------------------------------------------ | ---------- | --------------------- |
| M0–M19 | …                                                | ✅ Done    | M19 `2fad006`         |
| M20    | Performance / reliability / DR                   | ✅ Done    | ADR-039               |
| M21    | Security lab / OWASP intentional vulnerabilities | ⏳ Pending | `docs/HANDOFF-M21.md` |

## Commits

| Commit    | Nội dung                        |
| --------- | ------------------------------- |
| `2fad006` | M19 preflight/release readiness |
| `f202367` | M19 docs hash                   |
| _(TBD)_   | M20 performance/reliability/DR  |

## M20 checklist (Done)

- [x] k6 performance scenarios + thresholds
- [x] Resilience test plans / failure-mode expectations
- [x] Backup/restore validation (isolated / dry-run)
- [x] DR RPO/RTO draft
- [x] SLI/SLO draft
- [x] Alert readiness (static rules/docs)
- [x] Incident / performance / resilience / DR runbooks
- [x] Docs + ADR-039 + HANDOFF-M21
- [ ] Feature commit + docs hash _(in progress)_

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

### 2026-07-30 — M20 done

- k6 scenarios, resilience/DR/SLO/incident docs, alert YAML, dry-run scripts, ADR-039, HANDOFF-M21.
- **Không** bắt đầu intentional OWASP lab trong commit M20.

### 2026-07-30 — M19 done

- Feat `2fad006` / docs `f202367`.
