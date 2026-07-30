# Known Limitations — NexaTech

| Area             | Limitation                                                                             |
| ---------------- | -------------------------------------------------------------------------------------- |
| Auth at edge     | Service-to-service still accepts `x-user-*` headers pending full JWT mesh              |
| Login rate limit | In-process memory (per pod); not distributed — use Kong rate-limit in prod             |
| OTEL SDK         | Env wiring present; full Nest OTEL SDK not bundled (ADR-037)                           |
| k6               | Requires separate k6 install; lab thresholds ≠ prod SLO                                |
| Security lab     | Vulnerable code paths gated by deploy profile env; prefer dedicated `*-sec-lab` images |
| DR               | RPO/RTO are drafts pending operator sign-off                                           |
| External edge    | Citrix/Imperva/Kong live apply are operator-owned                                      |

## Out of product scope

Voucher, flash sale, SIM, network gear, home appliances (see AGENTS.md).
