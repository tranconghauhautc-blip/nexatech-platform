# Final Handoff — NexaTech M0–M21+

Ngày: **2026-08-01** (ADR-044 always-on WAF PoC)

## Roadmap

M0–M21 **complete** (see `docs/PROGRESS.md`). **Do not start M22** in this handoff.

## Commits

| Milestone | Feat commit |
| --------- | ----------- |
| M19       | `2fad006`   |
| M20       | `53247e4`   |
| M21       | `20e98bb`   |

Post-M21 hardening / gap-close commits are recorded in `docs/PROGRESS.md`.

## Security / WAF PoC summary (ADR-044)

| Metric                        | Value                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| Intentional vulnerabilities   | SC-01…SC-67 + SC-70…SC-95 (see `docs/OWASP-SCENARIOS.md`)            |
| Runtime gate                  | **None** — vulns ALWAYS ON (no `FORCE_SECURE`, no dual-gate toggle)   |
| OWASP API Top 10 coverage     | API1–API10 (~30+ API-mapped SC IDs)                                   |
| OWASP Web Top 10 coverage     | A01–A10 (~30+ Web-mapped SC IDs)                                      |
| Policy tests                  | `pnpm security:test:secure` and `security:test:lab` (both vulnerable) |
| Helm profiles                 | Isolation only (`values-production` / `values-security-lab`) — **not** vuln toggles |
| Public guides                 | `/lab/owasp-api-top10.html`, `/lab/owasp-web-top10.html`              |

## BLOCKED_EXTERNAL (operator)

1. `helm upgrade` / `kubectl apply` prod + lab
2. `docker push` after login
3. Kong apply `.209`
4. Citrix ADC allowlist (lab + prod)
5. Imperva WAF policies
6. Firewall / public TLS
7. Real SMTP/OAuth/VNPay/shipping credentials
8. Postgres backup restore drill on isolated DB

## Validation commands

```powershell
pnpm format; pnpm lint; pnpm test; pnpm build; pnpm e2e
pnpm security:test:secure
$env:SECURITY_LAB_ACK='YES'; pnpm security:test:lab
pnpm security:validate
helm lint deploy/helm/nexatech
helm template nexatech deploy/helm/nexatech -f deploy/helm/nexatech/values-production.yaml -n nexatech | Out-Null
helm template nexatech-lab deploy/helm/nexatech -f deploy/helm/nexatech/values-security-lab.yaml -n nexatech-security-lab | Out-Null
.\scripts\check-secret-leak.ps1
.\scripts\deploy-preflight.ps1 -DryRun -SkipKube -SkipConnectivity
```

## Working tree

HEAD on `main` after gap-close. **Roadmap M0–M21 complete. Do not start a new milestone.**
