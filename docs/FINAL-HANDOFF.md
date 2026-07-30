# Final Handoff — NexaTech M0–M21

Ngày: **2026-07-30**

## Roadmap

M0–M21 **complete** (see `docs/PROGRESS.md`). **Do not start M22** in this handoff.

## Commits

| Milestone | Feat commit |
| --------- | ----------- |
| M19       | `2fad006`   |
| M20       | `53247e4`   |
| M21       | `20e98bb`   |

HEAD after docs hash commit will be recorded in PROGRESS.

## Security lab summary

| Metric                        | Value                                                           |
| ----------------------------- | --------------------------------------------------------------- |
| Intentional vulnerabilities   | **22** (see OWASP-SCENARIOS.md)                                 |
| Reproducible via policy tests | **22**                                                          |
| OWASP API Top 10 coverage     | API1,2,3,4,5,7,8 (+ business)                                   |
| OWASP Web coverage            | A05 misconfig (cookie/CORS), A10 SSRF/path (BFF)                |
| Production secure regression  | `pnpm security:test:secure`                                     |
| Lab tests                     | `SECURITY_LAB_ACK=YES pnpm security:test:lab`                   |
| Lab isolation                 | ns `nexatech-security-lab`, separate secrets/DBs, NetworkPolicy |
| Prod image tag                | `0.17.0`                                                        |
| Lab image tag                 | `0.21.0-sec-lab`                                                |
| Helm prod                     | `values-production.yaml` (`securityLab.enabled: false`)         |
| Helm lab                      | `values-security-lab.yaml` (`securityLab.enabled: true`)        |

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

Must be clean after M21 docs hash commit. HEAD on `main`. **Roadmap M0–M21 complete. Do not start a new milestone.**
