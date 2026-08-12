# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Lab kit one-command Helm + GHCR public
- **Cập nhật lần cuối:** 2026-08-12
- **Branch:** `fix/media-upload-profile-minimal-reset`
- **Verdict:** **READY_FOR_HELM_DEPLOY** (lab kit packaged)

### Lab kit + GHCR public (2026-08-12)

- [x] All 18 GHCR packages set to **public** (`ghcr.io/tranconghauhautc-blip/nexatech/*`)
- [x] Anonymous manifest pull verified (`identity-service:0.17.0`, `cart-service:0.17.1-migrate`)
- [x] Script `scripts/package-lab-kit.ps1` → `dist/nexatech-lab-kit-0.17.2.zip`
- [x] Kit includes: `charts/nexatech-0.17.2.tgz`, `values-ghcr.yaml`, `install.ps1` / `install.sh`, `secret.env.example`
- [x] Doc: `docs/deployment/LAB-ONE-COMMAND.md`
- [x] `pnpm lab:kit` alias in package.json

### Exact Helm command (repo hoặc kit)

```powershell
# Từ repo:
helm upgrade --install nexatech deploy/helm/nexatech `
  -n nexatech `
  -f deploy/environments/staging/values-ghcr.yaml `
  --wait --timeout 20m

# Từ lab kit zip:
.\install.ps1
```

Apps: `:0.17.0` · Migrations: `:0.17.1-migrate` · Chart: `0.17.2`

### Migration image fix (trước đó)

- [x] pipefail fix + `0.17.1-migrate` pushed
- [x] Chart `0.17.2` / commit `6e2cc49`
