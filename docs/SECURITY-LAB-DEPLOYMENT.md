# Security Lab Deployment — M21

## Build lab images

```powershell
$env:IMAGE_TAG='0.21.0-sec-lab'
# Bake lab profile into image env (example for identity):
docker build -f apps/identity-service/Dockerfile `
  --build-arg NEXATECH_SECURITY_LAB=1 `
  --build-arg NEXATECH_DEPLOY_PROFILE=security-lab `
  -t nexatech/identity-service:0.21.0-sec-lab .
```

Script helper: `scripts/docker-build-security-lab.ps1` (builds representative set).

Helm still injects `NEXATECH_*` from values — lab values set `securityLab.enabled: true`.

## Helm (dry-run / template only in unattended)

```powershell
helm lint deploy/helm/nexatech
helm template nexatech-lab deploy/helm/nexatech `
  -f deploy/helm/nexatech/values-security-lab.yaml `
  --namespace nexatech-security-lab | Out-Null
```

**OPERATOR** for live: create ns, lab secrets, then `helm upgrade --install` — never from agent unattended.

## Kong / Citrix / Imperva

Lab routes must be allowlisted separately. **BLOCKED_EXTERNAL** for live Kong/ADC/WAF changes.

## Seed

Use fake catalog/identity data only. No real PII.
