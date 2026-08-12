# NexaTech Lab Kit (chart 0.17.2)

Portable **Helm chart + install scripts**. Images live on GHCR (not inside this zip).

## Images

| Kind | Tag |
|------|-----|
| Apps / portals | `:0.17.0` |
| Prisma migrate | `:0.17.1-migrate` |

Registry: `ghcr.io/tranconghauhautc-blip/nexatech/<service>:<tag>`

All 18 packages are **public** - no `GHCR_TOKEN` / `imagePullSecret` needed.

See `images-manifest.json`.

## Lab machine prerequisites (once)

1. `kubectl` + `helm` + kubeconfig
2. StorageClass `local-path`
3. MetalLB pool includes VIP `192.168.4.204`
4. External PostgreSQL `192.168.3.50:5432` (DB + user per service)
5. Copy `secret.env.example` to `secret.env` and fill real passwords

## One-command install

PowerShell:

```powershell
copy secret.env.example secret.env
# edit secret.env
.\install.ps1
```

Bash:

```bash
cp secret.env.example secret.env
# edit secret.env
chmod +x install.sh
./install.sh
```

If packages were private again:

```powershell
$env:GHCR_USERNAME='tranconghauhautc-blip'
$env:GHCR_TOKEN='ghp_xxx'   # PAT with read:packages
.\install.ps1
```

## Plain Helm (without install.ps1)

```powershell
kubectl create namespace nexatech
kubectl -n nexatech create secret generic nexatech-secrets --from-env-file=.\secret.env
helm upgrade --install nexatech .\charts\nexatech-0.17.2.tgz `
  -n nexatech `
  -f .\values-ghcr.yaml `
  --wait --timeout 20m
```

## Not in this chart

- Kong (VM `192.168.4.209`) - declarative config under `infra/kong/`
- Creating PostgreSQL databases (run create-databases on a host with DB admin rights)

## Docs

Full Vietnamese guide in the repo: `docs/deployment/LAB-ONE-COMMAND.md`
