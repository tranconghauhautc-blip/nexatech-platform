# Security Baseline — NexaTech M18

Production security defaults for Kubernetes packaging (M17/M18). **M21** adds an isolated security-lab profile (`values-security-lab.yaml`) with intentional vulnerabilities — production profile must keep `securityLab.enabled: false` and `deployProfile: production`.

## Container hardening

Helm values (`deploy/helm/nexatech/values.yaml`):

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 10001
  fsGroup: 10001
  seccompProfile:
    type: RuntimeDefault

containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: false # Nest/Next need tmp; tighten per-app when feasible
  runAsNonRoot: true
  capabilities:
    drop:
      - ALL
```

| Control                                     | Status    | Notes                                           |
| ------------------------------------------- | --------- | ----------------------------------------------- |
| Non-root UID **10001**                      | Required  | Dockerfiles + migrate images                    |
| Drop all capabilities                       | Required  | No `NET_BIND_SERVICE` — apps listen >1024       |
| `allowPrivilegeEscalation: false`           | Required  |                                                 |
| `readOnlyRootFilesystem`                    | Target    | Enable when app writes only to mounted emptyDir |
| seccomp `RuntimeDefault`                    | Required  | Pod level                                       |
| No `privileged` / `hostPID` / `hostNetwork` | Forbidden | Except cluster infra (not in app chart)         |

Review new workloads against [Pod Security Standards — restricted](https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted).

## NetworkPolicy — enable path for production

Default: `networkPolicy.enabled: false` (small clusters / bootstrap).

Production enable sequence:

1. Deploy with policies **disabled**; confirm full smoke via VIP `.204`
2. Add explicit allow policies (not included in M17 default-deny template alone):
   - ingress from `entry` Deployment to app pods
   - ingress from app pods to `platform` (Redis, RabbitMQ, MinIO)
   - egress to DNS (`kube-system`) and PostgreSQL `.208:5432`
   - egress for OTLP collector when observability deployed
3. Staging: set `networkPolicy.enabled: true` in overlay
4. Production: enable after staging validation

Template: `deploy/helm/nexatech/templates/networkpolicy-ready.yaml` (default-deny ingress when enabled).

**Do not** expose Redis, RabbitMQ management, MinIO console, or Grafana via LoadBalancer in production values.

## Secret separation

| Rule                                 | Implementation                                     |
| ------------------------------------ | -------------------------------------------------- |
| No secrets in git                    | `secret-values.example.yaml` has placeholders only |
| App connection strings in K8s Secret | Keys `*-database-url`, JWT, platform keys          |
| Config non-sensitive in ConfigMap    | `configmap.yaml` — URLs without passwords          |
| Separate backup encryption keys      | Off-repo; not in `nexatech-secrets`                |
| Rotation                             | `docs/K8S-OPS.md` § Secret rotation                |

Use Sealed Secrets, SOPS, or External Secrets — never commit plaintext production values.

Scan before commit:

```bash
./scripts/check-secret-leak.sh
# or
.\scripts\check-secret-leak.ps1
```

## ServiceAccount and RBAC

- Workloads use dedicated ServiceAccount (`serviceaccount.yaml`) — **not** `default`
- No `cluster-admin` binding for application SA
- Helm release RBAC for operator human/group only
- Migrate Jobs use same SA or dedicated migrate SA with minimal permissions (Job only)

Future: per-service SA if cross-pod access needs narrowing further.

## Image supply chain

| Rule                            | Detail                                                   |
| ------------------------------- | -------------------------------------------------------- |
| No `latest` tag                 | `global.imageTag` semver or git SHA                      |
| `imagePullPolicy: IfNotPresent` | Production pin tags                                      |
| `imagePullSecrets`              | `dockerhub-pull` for private/rate-limit Hub              |
| Base images                     | `node:*-slim` — rebuild on CVE advisories                |
| Scan                            | Run Trivy/Grype on CI or pre-push (optional script M18+) |

Build scripts do **not** embed credentials (`scripts/docker-build-all.*`).

## Management console exposure

| Service             | Production exposure                              |
| ------------------- | ------------------------------------------------ |
| Grafana             | ClusterIP + port-forward / internal ingress only |
| RabbitMQ management | ClusterIP only (`platform-rabbitmq`)             |
| MinIO console       | ClusterIP only                                   |
| Kong admin API      | Bind localhost on `.209` or firewall restrict    |
| PostgreSQL          | `.208` firewall: workers + admin jump host only  |

Public internet should terminate at ADC/WAF → Kong → VIP — not at platform admin ports.

## Dependency and exposure review

Periodic (each release):

1. `pnpm audit` / Dependabot — triage critical CVEs
2. Container scan on pushed images
3. Review new env vars in Helm templates for accidental secret defaults
4. Confirm Kong routes do not expose admin paths publicly
5. Verify CORS and auth on `/api/v1` vs public catalog reads
6. Document accepted risks in `docs/DECISIONS.md` ADR if deferred

## Application security (baseline, not OWASP lab)

M18 maintains normal secure defaults:

- JWT access + refresh; session in Redis
- RBAC: Staff, Manager, Admin, Super Admin
- Unified error shape without stack traces in production
- `requestId` / `traceId` correlation
- Prisma parameterized queries (no raw SQL injection by default)
- File upload validation in media-service

**Explicit:** Production profile does **not** enable intentional OWASP vulnerabilities. Security-lab profile (`values-security-lab.yaml`) hosts intentional scenarios documented in `docs/OWASP-SCENARIOS.md` (API Top 10:2023 + Web Top 10:2025). Production must keep `securityLab.enabled: false` and `deployProfile: production`.

## Ingress and TLS

- TLS at ADC/WAF or Kong VM — not skipped on public storefront
- Internal VIP `.204` may be HTTP within trusted LAN; document threat model if so
- HSTS, secure cookies for admin (`httpOnly`, `secure`, `sameSite`) — frontend config via env

## Audit and logging

- Sensitive actions → audit log (identity/reporting services)
- Structured logs — no password/token fields
- Log aggregation (Loki) access restricted to ops roles

## Checklist — production go-live security

- [ ] All pods `runAsUser: 10001`, capabilities dropped
- [ ] No `latest` images in running cluster
- [ ] `nexatech-secrets` populated; example file not used as-is
- [ ] `check-secret-leak` clean on release branch
- [ ] Platform services ClusterIP only
- [ ] NetworkPolicy plan documented (enabled or staged)
- [ ] Postgres `.208` not publicly routable
- [ ] Backup encrypted off-repo
- [ ] OWASP intentional scenarios **not** deployed on production profile (lab-only)

## Related documents

- `docs/K8S-OPS.md`
- `docs/DEPLOY-RUNBOOK-PRODUCTION.md`
- `docs/BACKUP-RESTORE.md`
- `docs/OWASP-SCENARIOS.md`
- `docs/SECURITY-LAB-ARCHITECTURE.md`
- `deploy/helm/nexatech/secret-values.example.yaml`
