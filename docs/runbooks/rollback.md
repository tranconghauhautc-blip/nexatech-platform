# Rollback runbook

## Helm rollback

```powershell
helm history nexatech -n nexatech
helm rollback nexatech <REVISION> -n nexatech
helm history nexatech-kong -n nexatech
helm rollback nexatech-kong <REVISION> -n nexatech
kubectl -n nexatech rollout status deploy --timeout=10m
```

## Image rollback

Redeploy previous immutable tag from `deploy/checkpoints/images-*.json` via Helm `--set global.imageTag=<previous>`.

## Database

1. Stop writers (scale deploy to 0) if restoring.
2. Restore from `deploy/checkpoints/backups/<stamp>/*.dump` using `pg_restore`.
3. Re-run verify: `pwsh -File scripts/deployment/verify-databases.ps1`.
4. Never restore onto the wrong host — confirm `POSTGRES_HOST` summary first.

## Kong

If proxy broken: rollback `nexatech-kong` release; Admin API remains ClusterIP-only for diagnostics:

```powershell
kubectl -n nexatech port-forward svc/nexatech-kong-admin 8001:8001
```
