# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Migration image pipefail fix + GHCR publish
- **Cập nhật lần cuối:** 2026-08-12
- **Branch:** `fix/media-upload-profile-minimal-reset`
- **Verdict:** **READY_FOR_HELM_DEPLOY**

### Migration image fix (2026-08-12)

- [x] Root cause: `deploy/docker/prisma-migrate.Dockerfile` baked `/app/migrate.sh` with bash `pipefail`
- [x] Bake service name at build time (avoid `set -u` on unset `SERVICE_NAME`)
- [x] Helm: `global.migrationImageTag: '0.17.1-migrate'` (apps stay `0.17.0`)
- [x] Chart version `0.17.2`
- [x] Built + pushed all 14 `*:0.17.1-migrate` images to GHCR
- [x] Remote manifests verified for all 14
- [x] Verified cart migrate image: `set -eu`, no pipefail
- [x] `pnpm helm:lint` + `helm:validate` + handoff tests PASSED
- [x] Commit `6e2cc49` pushed

### Exact Helm command

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -n nexatech `
  -f deploy/environments/staging/values-ghcr.yaml
```

Apps: `:0.17.0` · Migrations: `:0.17.1-migrate`
