# Database clean runbook

Mandatory sequence (never bypass):

1. Identify target (`POSTGRES_HOST`) and print summary.
2. `pwsh -File scripts/deployment/backup-databases.ps1` — verify non-empty dumps (or documented skip if DB absent).
3. Set `NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN=YES_I_UNDERSTAND` in `.env.deploy.local`.
4. `pwsh -File scripts/deployment/clean-databases.ps1` (supports `-DryRun`).
5. `pwsh -File scripts/deployment/create-databases.ps1`
6. `pwsh -File scripts/deployment/migrate-all.ps1`
7. `pwsh -File scripts/deployment/seed-required.ps1` — accounts only.
8. `pwsh -File scripts/deployment/verify-databases.ps1`

Refusal without confirmation exit code `3`.
