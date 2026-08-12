# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Migration image pipefail fix + GHCR publish
- **Cập nhật lần cuối:** 2026-08-12
- **Branch:** `fix/media-upload-profile-minimal-reset`
- **Verdict:** **PENDING_GHCR_PUSH** (source + local images ready; GHCR push blocked on `write:packages`)

### Migration image fix (2026-08-12)

- [x] Root cause: `deploy/docker/prisma-migrate.Dockerfile` baked `/app/migrate.sh` with bash `pipefail`
- [x] Also fixed: bake service name at build time (avoid `set -u` failing on unset `SERVICE_NAME`)
- [x] Helm: `global.migrationImageTag` (apps stay `0.17.0`, migrate uses `0.17.1-migrate`)
- [x] Chart version `0.17.2`
- [x] Built locally all 14 `*:0.17.1-migrate` images
- [x] Verified cart migrate image: `set -eu`, no pipefail; prisma starts (fails only without DB URL)
- [x] `pnpm helm:lint` + `helm:validate` + handoff tests PASSED
- [ ] Push 14 images to GHCR — needs `gh auth refresh -s write:packages,read:packages` (device flow)
- [ ] Remote manifest verify for all 14

### Exact Helm command (after GHCR push)

```powershell
helm upgrade --install nexatech deploy/helm/nexatech `
  -n nexatech `
  -f deploy/environments/staging/values-ghcr.yaml
```

Apps: `:0.17.0` · Migrations: `:0.17.1-migrate`
