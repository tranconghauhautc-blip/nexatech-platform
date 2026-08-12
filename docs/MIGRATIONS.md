# Migration runbook (Prisma) — NexaTech M17/M19

## Safe commands only

```text
prisma migrate deploy
```

## NEVER on production data

```text
prisma migrate reset
prisma db push
DROP DATABASE / DROP SCHEMA / TRUNCATE
```

## Principles (M19)

| Rule       | Detail                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Command    | **migrate deploy only**                                                    |
| Databases  | One database per service (app users `nexatech_*`, never role `postgres`)   |
| Failure    | Migration Job failure **blocks** Helm rollout (`backoffLimit: 1`)          |
| Images     | Tag `{IMAGE_TAG}-migrate`; never `latest`                                  |
| Sequencing | Independent per DB; preferred contract order in `docs/DEPLOYMENT-ORDER.md` |
| Unattended | Agents do not run migrate against production                               |

Images:
- Tag `{IMAGE_TAG}-migrate` by default
- Or explicit `global.migrationImageTag` (e.g. `0.17.1-migrate`) when apps stay on an older app tag

Build migrate images (tag `${IMAGE_TAG}-migrate` or explicit):

```powershell
.\scripts\docker-build-all.ps1 -Image identity-service
# or all backends
.\scripts\docker-build-all.ps1
```

## Helm hooks

Chart runs one Job per Prisma service as `pre-install,pre-upgrade` hooks.
`backoffLimit: 1` — fail clearly; do not retry forever.
`ttlSecondsAfterFinished: 86400`.
Hook delete policy: `before-hook-creation,hook-succeeded`.

Hook ordering (clean-cluster install must not deadlock):

| Weight | Resource | Notes |
| ------ | -------- | ----- |
| `-10` | `ServiceAccount` | `pre-install,pre-upgrade`; delete policy `before-hook-creation` only (persists for Deployments) |
| `-5` | migrate Jobs | Need SA + operator Secret `*-database-url` only; POSIX `set -eu` (no bash `pipefail`) |

Do **not** require a manually pre-created ServiceAccount. Do **not** make migrate Jobs depend on Redis/RabbitMQ/MinIO.

## Retry after failure

1. Inspect Job logs: `kubectl -n nexatech logs job/<service>-migrate`
2. Fix Secret `*-database-url` / network / DB grants (app user, not `postgres`)
3. Delete failed Job if still present: `kubectl -n nexatech delete job <service>-migrate` (**OPERATOR**)
4. Re-run: `helm upgrade ...` or create Job from rendered manifest
5. Re-run preflight: `.\scripts\deploy-preflight.ps1`

## Failed Job cleanup procedure

1. Confirm Job status `Failed`
2. Capture logs + events for incident ticket
3. Delete Job object only (not PVC, not Secret)
4. Do not leave stuck hooks blocking subsequent upgrades
5. After fix, single Helm upgrade — avoid concurrent migrate Jobs on same DB

## Rollback strategy

- **Application rollback:** `helm rollback <release> <revision>` (pods to previous image)
- **Schema rollback:** restore PostgreSQL from backup into **isolated test DB**, smoke, then promote — never invent ad-hoc down migrations on production without tested SQL
- **Partial migrate success:** treat as incident; do not continue rollout until DBs consistent with intended revision

## Concurrency

Hooks use `hook-delete-policy: before-hook-creation` so a new upgrade replaces the previous Job object. Concurrent migrate Jobs for the same DB should be avoided — run Helm sequentially.

## Seed after migrate

See `docs/DEPLOYMENT-ORDER.md` seed sequencing and `scripts/seed-catalog-production.cjs` (requires `CONFIRM_PRODUCTION=YES`).

## Preflight

`scripts/deploy-preflight.ps1` / `.sh` verify migrate Dockerfile presence, tag policy, and Helm template hooks statically.
