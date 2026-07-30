# Incident Response — NexaTech (M20)

## Severity

| Sev  | Definition                                             | Response                 |
| ---- | ------------------------------------------------------ | ------------------------ |
| Sev1 | Storefront/API down; data loss risk; payment integrity | Immediate page; war room |
| Sev2 | Major feature degraded (checkout, login, inventory)    | 15m ack                  |
| Sev3 | Partial degradation; workaround exists                 | Business hours           |
| Sev4 | Cosmetic / minor                                       | Backlog                  |

## Triage

1. Confirm severity and blast radius (VIP `.204`, Kong `.209`, PG `.208`).
2. Capture `requestId` / `traceId` from error envelope.
3. Check: entry `/healthz`, identity/catalog ready, migrate Jobs, MetalLB VIP.
4. Decide: rollback vs fix-forward vs DR restore.

## Communication

- Internal: on-call + release owner
- External: only after Sev1/2 confirmed (operator comms plan)
- Never paste secrets, tokens, or PII into tickets/chat

## Rollback

- App: `helm rollback` to last good revision (**OPERATOR**)
- Kong: previous declarative file on `.209`
- Schema: restore backup to isolated DB → validate → promote

## Evidence collection

- `kubectl get/describe/logs` (read-only first)
- Helm revision history
- Recent deploy ticket / image digests
- Prometheus/Grafana panels (ClusterIP — via admin jump host)
- Sanitized logs only (redaction enforced in shared-logging)

## Containment

- Scale down bad Deployment if crash-looping and burning nodes
- Disable flaky route at Kong if single upstream poisoned
- Rotate leaked secrets (**OPERATOR**)

## Recovery

- Follow `docs/DISASTER-RECOVERY.md` and `docs/K8S-OPS.md`
- Re-run `scripts/smoke-release.*` and `deploy-preflight.*`

## Postmortem

Within 5 business days for Sev1/2:

- Timeline, root cause, contributing factors
- Customer impact
- Action items with owners/dates
- Update runbooks / alerts / tests

## Related

- `docs/RESILIENCE-TESTING.md`
- `docs/SLO-SLI.md`
- `docs/RELEASE-CHECKLIST.md`
