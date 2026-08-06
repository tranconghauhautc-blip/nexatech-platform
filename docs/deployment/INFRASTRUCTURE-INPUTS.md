# Infrastructure input matrix — NexaTech

**Owner model:** DevOps / System fill real values in gitignored `.env.deploy.local` (from `.env.deploy.local.example`).  
**Never commit credentials.** Placeholders only below.

Loader: `scripts/deployment/_common.ps1` → `Import-NexaTechDeployEnv`.

| Variable | Owner | Purpose | Required | Example placeholder | Secret / ConfigMap | Consumer | How to verify |
| -------- | ----- | ------- | -------- | ------------------- | ------------------ | -------- | ------------- |
| `KUBECONFIG` | DevOps | Path to cluster kubeconfig | Required for deploy | `C:\kube\nexatech.conf` | File (host) | kubectl / helm / deploy scripts | `kubectl get nodes` |
| `K8S_APP_NODE_NAMES` | DevOps | Comma-separated app worker node names | Required for label step | `k8s-app-1,k8s-app-2,k8s-app-3` | Env | `scripts/deployment/label-nodes.ps1` | `kubectl get nodes --show-labels` shows `nexatech.io/role=app` |
| `KONG_NODE_NAME` | DevOps | Dedicated Kong node name | Required (or IP) | `k8s-kong-1` | Env | `label-nodes.ps1`, Kong Helm nodeSelector | Node has `nexatech.io/role=kong` |
| `KONG_NODE_IP` | DevOps | Resolve Kong node when name unknown | Optional if name set | `192.168.4.209` | Env | `label-nodes.ps1` | Matches node InternalIP |
| `POSTGRES_HOST` | System | External PostgreSQL 16 host | Required | `192.168.4.208` | Config / Secret ref | Helm `global.postgresql.host`, DB scripts | `psql -h … -c 'SELECT version();'` |
| `POSTGRES_PORT` | System | PostgreSQL port | Required | `5432` | Config | DB scripts / Helm | Same `psql` probe |
| `POSTGRES_ADMIN_USER` | System | Admin role for create/backup (not app runtime) | Required | `nexatech_admin` | Secret | `create-databases.ps1`, backups | Login succeeds; apps use per-service users |
| `POSTGRES_ADMIN_PASSWORD` | System | Admin password | Required | `(operator-generated)` | Secret | DB scripts | Login succeeds; never logged |
| `CONTAINER_REGISTRY_URL` | DevOps | Registry host for push/pull | Required for push | `registry.example.com` | Config | `scripts/images/*`, imagePullSecret | `docker login` + pull test |
| `CONTAINER_REGISTRY_USERNAME` | DevOps | Registry username | Required for push | `nexatech-ci` | Secret | docker login / pull secret | Login OK |
| `CONTAINER_REGISTRY_TOKEN` | DevOps | Registry token/password | Required for push | `(token)` | Secret | docker login / pull secret | Login OK |
| `METALLB_ADDRESS_POOL` | DevOps | MetalLB IP pool CIDR/range | Required if no LB | `192.168.4.200-192.168.4.210` | Config | `deploy/metallb/ipaddresspool.yaml.tpl`, deploy-sequence | `kubectl get ipaddresspool -A` |
| `KONG_EXTERNAL_IP` | DevOps | External VIP/IP for Kong proxy | Required for edge | `192.168.4.205` | Config | Kong Service `loadBalancerIP` / DNS | `kubectl get svc -n nexatech` EXTERNAL-IP |
| `PUBLIC_BASE_URL` | DevOps | Public storefront base URL | Required for acceptance | `http://192.168.4.204` | ConfigMap / values | Frontends, smoke | HTTP 200 on `/` |
| `API_PUBLIC_URL` | DevOps | Public API / Kong proxy base | Required | `http://192.168.4.204:8000` | ConfigMap / values | BFF, clients, smoke | `GET /api/v1/products` |
| `ADMIN_PUBLIC_URL` | DevOps | Public admin URL | Required | `http://192.168.4.204:3100` | ConfigMap / values | Admin web, smoke | Admin login page loads |
| `SWAGGER_PUBLIC_URL` | DevOps | Combined Swagger portal URL | Optional (staging) | `http://192.168.4.204:8090` | ConfigMap / values | swagger-portal | `/docs` + `/health` |
| `SECURITY_GUIDE_PUBLIC_URL` | DevOps | Security Guide portal URL | Optional (lab/staging) | `http://192.168.4.204:3200` | ConfigMap / values | security-guide-portal | `/health` ready; unauth redirects |
| `REQUIRED_SEED_PASSWORD` | DevOps | Strong password for required RBAC accounts | Required for seed | `(operator-generated ≥12)` | Secret | `scripts/deployment/seed-required.ps1` | Seed writes emails to `.secrets/seeded-accounts.txt` |
| `SMTP_HOST` | System | SMTP host (Gmail or relay) | Optional staging; recommended prod | `smtp.gmail.com` | Secret / Config | notification-service | Send test email / Mailpit in lab |
| `SMTP_PORT` | System | SMTP port | Optional | `587` | Config | notification-service | TLS handshake OK |
| `SMTP_SECURE` | System | SMTPS flag | Optional | `false` | Config | notification-service | Matches provider |
| `SMTP_USERNAME` | System | SMTP auth user | Optional | `noreply@example.com` | Secret | notification-service | Auth succeeds |
| `SMTP_APP_PASSWORD` | System | SMTP app password | Optional | `(app-password)` | Secret | notification-service | Auth succeeds; never commit |
| `SMTP_FROM_NAME` | DevOps | From display name | Optional | `NexaTech` | Config | notification-service | Visible in received mail |
| `SMTP_FROM_EMAIL` | DevOps | From address | Optional | `noreply@example.com` | Config | notification-service | Matches provider policy |

### Related optional variables (see `.env.deploy.local.example`)

| Variable | Notes |
| -------- | ----- |
| `CONTAINER_REGISTRY_NAMESPACE` | Default `nexatech` |
| `NEXATECH_IMAGE_TAG` | Immutable build tag (never `latest`) |
| `HELM_NAMESPACE` / `HELM_RELEASE_NAME` / `HELM_KONG_RELEASE_NAME` | Defaults `nexatech` / `nexatech` / `nexatech-kong` |
| `NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN` | Exact confirmation string for destructive clean |
| `MAILPIT_ENABLED` / `MAILPIT_PUBLIC_URL` | Staging/lab email UI |
| `SECURITY_GUIDE_USERNAME` | Default docs portal user; password hash in `.secrets/` |

### SMTP switch (Mailpit → Gmail)

| Environment | Mechanism |
| ----------- | --------- |
| Isolated E2E Compose | Mailpit in `infra/docker/docker-compose.e2e.yml` (`SMTP_HOST=mailpit`) |
| Local lab | Mailpit in `infra/docker/docker-compose.dev.yml` |
| Staging/Production | Set `SMTP_*` only — no code change; secrets via Helm Secret refs (`secret-values.example.yaml`) |

### Verification helpers

```powershell
pwsh -File scripts/deployment/deploy-sequence.ps1 -DryRun
.\scripts\deploy-preflight.ps1 -DryRun -SkipKube -SkipConnectivity
pwsh -File scripts/check-secret-leak.ps1
```
