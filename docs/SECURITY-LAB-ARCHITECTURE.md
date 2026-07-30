# Security Lab Architecture — M21

## Dual profile

| Profile      | Helm values                | deployProfile  | SECURITY_LAB | Image tag        |
| ------------ | -------------------------- | -------------- | ------------ | ---------------- |
| Production   | `values-production.yaml`   | `production`   | `0`          | `0.17.0`         |
| Security lab | `values-security-lab.yaml` | `security-lab` | `1`          | `0.21.0-sec-lab` |

Gate: `libs/shared/security-lab` — `isSecurityLabEnabled()` requires **both** env vars. Not controllable via HTTP.

## Isolation

- Namespace: `nexatech-security-lab`
- Secrets: `nexatech-lab-secrets` (fake only)
- PostgreSQL: lab host/DBs/users only
- Redis/RabbitMQ/MinIO: chart platform in lab namespace (or dedicated vhost/prefix/bucket)
- No production PVC sharing
- No production OAuth/SMTP/VNPay/shipping credentials
- Lab marker: `GET /health/lab` on identity (404 when not lab)

## Vulnerability packaging

Policy helpers in `@nexatech/shared-security-lab` are called from order/payment/review/shipping/warranty/support/media/identity and BFF sanitizer. Production behavior is the default when flags are off.

## Related

- `docs/SECURITY-LAB-DEPLOYMENT.md`
- `docs/SECURITY-LAB-SAFETY.md`
- `docs/OWASP-SCENARIOS.md`
