# Security Lab Deployment — M21+ / ADR-044

**ADR-044:** Intentional vulnerabilities are always-on in application code. Helm/image `NEXATECH_SECURITY_LAB` flags are **legacy isolation markers only** — they do not disable vulns.

## Build images (optional security-lab namespace tags)

```powershell
$env:IMAGE_TAG='0.21.0-sec-lab'
# Optional namespace/isolation markers (do NOT gate vulns):
docker build -f apps/identity-service/Dockerfile `
  --build-arg NEXATECH_SECURITY_LAB=1 `
  --build-arg NEXATECH_DEPLOY_PROFILE=security-lab `
  -t nexatech/identity-service:0.21.0-sec-lab .
```

Script helper: `scripts/docker-build-security-lab.ps1` (builds representative set).

Helm may still inject `NEXATECH_*` from values for namespace hygiene.

## Helm (dry-run / template only in unattended)

```powershell
helm lint deploy/helm/nexatech
helm template nexatech-lab deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-security-lab.yaml `
  --namespace nexatech-security-lab | Out-Null

helm template nexatech deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-production.yaml `
  --namespace nexatech | Out-Null
```

**OPERATOR** for live: create ns, lab secrets, then `helm upgrade --install` — never from agent unattended.

## Kong / Citrix / Imperva

Lab routes must be allowlisted separately. **BLOCKED_EXTERNAL** for live Kong/ADC/WAF changes.

## Seed (local/dev only)

Use `pnpm seed:accounts` with operator-defined `DEV_SEED_PASSWORD`. Fake data only. No real PII. Never run against production DB.

```powershell
$env:NODE_ENV="development"
$env:NEXATECH_ALLOW_DEV_SEED="YES"
$env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
$env:IDENTITY_DATABASE_URL="postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity"
pnpm seed:accounts
```

## Isolation checks

- Lab values must not reference production hostnames/credentials
- Do not assume `securityLab.enabled: false` makes the app secure — code paths are always-on vulnerable (ADR-044)
- PoC runners require `SECURITY_LAB_ACK=YES` + private targets
