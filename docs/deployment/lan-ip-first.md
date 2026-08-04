# Deployment — LAN / IP first (no public domain yet)

## Principles

- Deploy through Kong external IP / MetalLB pool.
- Application config uses `PUBLIC_BASE_URL`, `API_PUBLIC_URL`, `ADMIN_PUBLIC_URL`, `SWAGGER_PUBLIC_URL`, `SECURITY_GUIDE_PUBLIC_URL`.
- Domain + TLS are added later by Helm values only (no architecture change).

## Prerequisites (owner-provided once)

| Variable                                 | Purpose                  | How to obtain                                            | Where to enter      |
| ---------------------------------------- | ------------------------ | -------------------------------------------------------- | ------------------- |
| `KUBECONFIG`                             | Cluster access           | Copy from control-plane `~/.kube/config` or set SSH jump | `.env.deploy.local` |
| `KONG_NODE_NAME` / `KONG_NODE_IP`        | Dedicated Kong node      | `kubectl get nodes -o wide`                              | `.env.deploy.local` |
| `POSTGRES_HOST` + admin creds            | External DB server       | Infra inventory                                          | `.env.deploy.local` |
| `CONTAINER_REGISTRY_*`                   | Push immutable images    | Harbor/GHCR/Docker Hub                                   | `.env.deploy.local` |
| `METALLB_ADDRESS_POOL`                   | Stable Kong VIP if no LB | LAN IP range reserved for MetalLB                        | `.env.deploy.local` |
| `NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN` | Destructive DB clean     | Must be exactly `YES_I_UNDERSTAND`                       | `.env.deploy.local` |

Optional: Gmail SMTP — staging uses Mailpit; production SMTP can stay empty with degraded readiness.

## Resume

```powershell
# 1. Fill .env.deploy.local
# 2. Resume
pwsh -File scripts/deployment/resume-from-checkpoint.ps1 -Checkpoint 00-baseline
```

## /etc/hosts helper (optional)

```text
<KONG_EXTERNAL_IP>  nexatech.local admin.nexatech.local swagger.nexatech.local guide.nexatech.local
```

Prefer hostless IP paths first: `http://<KONG_IP>/`, `/admin`, `/swagger`, `/security-guide`.
