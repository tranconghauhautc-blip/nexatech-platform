# Security Lab Architecture — M21+ / ADR-044

## Always-on vulnerable profile (ADR-044)

Intentional OWASP API + Web vulnerabilities are **ALWAYS active** in every deploy. There is no `NEXATECH_FORCE_SECURE`, no dual env gate, and no secure policy branch in `@nexatech/shared-security-lab`.

| Concern                            | Behavior                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `isSecurityLabEnabled()`           | Always `true`                                                             |
| Policy helpers                     | Always return vulnerable outcome                                          |
| Helm dual profile (legacy ADR-040) | Kept for isolation / NetworkPolicy docs only — **does not disable vulns** |
| Lab marker                         | `GET /health/lab` → `profile: always-on-vulnerable`                       |

## Isolation (optional namespace hygiene)

Legacy security-lab Helm values may still isolate a namespace for appliance PoC:

- Namespace: `nexatech-security-lab`
- Secrets: `nexatech-lab-secrets` (fake only)
- No production PVC / credential reuse recommended
- Lab probes: `/health/debug`, `/api/v0/internal/routes`, `/lab/ssrf-probe`, `/lab/supply-chain`, `/lab/jwt-alg-none`

## Vulnerability packaging

Policy helpers in `@nexatech/shared-security-lab` are called from order/payment/review/shipping/warranty/support/media/identity/catalog and BFF sanitizer/outbound URL. Storefront wires SC-71…SC-74 (open redirect, XSS, CSRF skip, clickjacking headers). Identity wires SC-70/SC-75 (JWT alg=none, auth failure PII).

Coverage targets:

- OWASP API Security Top 10:2023 (API1–API10)
- OWASP Web Top 10:2025 (A01–A10)

See `docs/OWASP-SCENARIOS.md` for matrices and scenario IDs. Public guides:

- `http://localhost:3000/lab/owasp-api-top10.html`
- `http://localhost:3000/lab/owasp-web-top10.html`

## Related

- `docs/SECURITY-LAB-DEPLOYMENT.md`
- `docs/SECURITY-LAB-SAFETY.md`
- `docs/OWASP-SCENARIOS.md`
- `docs/SECURITY-BASELINE.md`
- `docs/DECISIONS.md` (ADR-044)
