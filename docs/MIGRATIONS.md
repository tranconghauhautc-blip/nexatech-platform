# Migration runbook (Prisma) — NexaTech M17

#

# Safe commands only:

# prisma migrate deploy

#

# NEVER on production data:

# prisma migrate reset

# prisma db push

# DROP DATABASE / DROP SCHEMA / TRUNCATE

## Image

Build migrate images (tag `${IMAGE_TAG}-migrate`):

```powershell
.\scripts\docker-build-all.ps1 -Image identity-service
# or all backends
.\scripts\docker-build-all.ps1
```

## Helm hooks

Chart runs one Job per Prisma service as `pre-install,pre-upgrade` hooks.
`backoffLimit: 1` — fail clearly; do not retry forever.

## Retry after failure

1. Inspect Job logs: `kubectl -n nexatech logs job/<service>-migrate`
2. Fix Secret `*-database-url` / network / DB grants (app user, not `postgres`)
3. Delete failed Job if still present: `kubectl -n nexatech delete job <service>-migrate`
4. Re-run: `helm upgrade ...` or create Job from rendered manifest

## Rollback

- Application rollback: `helm rollback <release> <revision>`
- Schema rollback: restore PostgreSQL from backup (see M18 backup runbook); do not invent down-migrations ad hoc on production without tested SQL.

## Concurrency

Hooks use `hook-delete-policy: before-hook-creation` so a new upgrade replaces the previous Job object. Concurrent migrate Jobs for the same DB should be avoided — run Helm sequentially.
