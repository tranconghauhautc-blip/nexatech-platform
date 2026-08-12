# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Helm one-command deploy readiness
- **Cập nhật lần cuối:** 2026-08-12
- **Branch:** `fix/media-upload-profile-minimal-reset`
- **Verdict:** **READY_FOR_HELM_DEPLOY**

### Helm one-command fix (2026-08-12)

- [x] ServiceAccount pre-install/pre-upgrade hook weight `-10` (persists; no manual SA)
- [x] Migration Jobs keep weight `-5`; POSIX `set -eu` (no bash `pipefail`)
- [x] MinIO bucket-init script also POSIX `set -eu`
- [x] NetworkPolicy: allow external→entry; ingress-only (egress to PG 192.168.3.50 open)
- [x] Staging GHCR overlay: `deploy/environments/staging/values-ghcr.yaml` (VIP, PG, local-path, otel off, public URLs)
- [x] `imagePullSecrets: []` by default; private GHCR optional via overlay
- [x] Chart version `0.17.1` / app `0.17.0` / migrate `0.17.0-migrate`
- [x] `pnpm helm:lint` + `pnpm helm:validate` + `tests/helm/handoff-render.test.cjs` PASSED
- [ ] Server-side dry-run / live `helm upgrade` — blocked locally (no kube-context)

### Lab + handoff (2026-08-06)

- [x] Isolated E2E lab `nexatech-e2e` running (infra + 14 backends + fronts + Kong + portals)
- [x] Kong 3.9 declarative fix: nest routes under services (`infra/kong/kong.yml` + `kong.production.yml`)
- [x] E2E migrate + seed (RBAC, customers, catalog 100, inventory, pickup)
- [x] Focused smoke: `pnpm lab:smoke` + Kong login/cart/forgot-password/Mailpit
- [x] Handoff: `docs/deployment/K8S-DEPLOYMENT-CHECKLIST.md`, `INFRASTRUCTURE-INPUTS.md`, `deploy/images-manifest.txt`
- [x] `pnpm helm:lint` + helm template + kubeconform (65 nexatech / 6 kong)
- [x] Regression: `tests/kong/kong-declarative-nesting.test.cjs`, `tests/helm/handoff-render.test.cjs`

## Exact one-command Helm install

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -n nexatech `
  -f deploy/environments/staging/values-ghcr.yaml
```

### Prerequisites only (not created by Helm)

1. Namespace `nexatech`
2. Secret `nexatech-secrets` (see `deploy/helm/nexatech/secret-values.example.yaml`)
3. StorageClass `local-path`
4. MetalLB pool covering `192.168.4.204`
5. External PostgreSQL `192.168.3.50:5432` with per-service DBs/users
6. Optional: `ghcr-pull` imagePullSecret **only if** GHCR packages are private

## Baseline

- Helm lint (nexatech + kong via Docker image): **PASSED**
- Helm template values-ghcr (69 resources, no duplicates): **PASSED**
- Handoff render tests: **PASSED**
- Secret leak scan / live cluster: N/A this pass (no kube-context)
