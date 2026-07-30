# Release Checklist — NexaTech (M19)

Operator checklist before and after a production (or staging) release. Agent unattended mode stops at dry-run / local validation — items marked **OPERATOR** require human confirmation.

## Pre-release

- [ ] Working tree clean; intended commit/tag identified
- [ ] Git tag prepared: `v0.17.0` (or release semver) — **OPERATOR** create/push tag
- [ ] Image tag matches Helm `global.imageTag` (never `latest`) — see `docs/IMAGE-MATRIX.md`
- [ ] `pnpm format` / `lint` / `test` / `build` / `e2e` green on release commit
- [ ] `.\scripts\deploy-preflight.ps1 -DryRun` (or bash) PASS / acceptable BLOCKED
- [ ] `.\scripts\check-secret-leak.ps1` clean
- [ ] Helm lint + template apps + observability production values
- [ ] Docker images built locally (or CI) for all frontend/backend/migrate targets
- [ ] Image push to registry — **OPERATOR** (`docker login` then `docker-build-all -Push`)
- [ ] PostgreSQL backup completed and checksum recorded — **OPERATOR** (`docs/BACKUP-RESTORE.md`)
- [ ] Kubernetes Secrets created/updated (names only in git) — **OPERATOR**
- [ ] imagePullSecret `dockerhub-pull` present in namespace
- [ ] Confirm kube-context is intended cluster — **OPERATOR**

## Deploy sequence (see `docs/DEPLOYMENT-ORDER.md`)

- [ ] Namespace + StorageClass + MetalLB verified
- [ ] Platform (Redis/RabbitMQ/MinIO) + bucket init
- [ ] Prisma migrate Jobs (`migrate deploy` only) success
- [ ] Production-safe seed only if confirmed (`CONFIRM_PRODUCTION=YES`) — **OPERATOR**
- [ ] Backend then frontend Deployments rolled
- [ ] MetalLB entry VIP `192.168.4.204` healthy
- [ ] Observability chart (optional same window)
- [ ] Kong declarative apply on VM `.209` — **OPERATOR / BLOCKED_EXTERNAL**
- [ ] Citrix / Imperva mapping — **OPERATOR / BLOCKED_EXTERNAL**

## Helm rollout

- [ ] `helm diff` (or `helm template` + review) against live values — **OPERATOR**
- [ ] `helm upgrade --install` — **OPERATOR** (never unattended without context verify)
- [ ] Watch Jobs: migrate hooks complete before pods Ready
- [ ] `kubectl rollout status` for critical Deployments

## Post-deploy verification

- [ ] `.\scripts\smoke-release.ps1 -ViaEntry` (from prod network)
- [ ] `.\scripts\validate-production.ps1` health checks
- [ ] Storefront `/`, admin `/admin` (via Kong), `/api/v1` sample catalog
- [ ] No management consoles public (Redis/RabbitMQ/MinIO/Grafana)
- [ ] Logs redacted (no raw tokens in sample lines)
- [ ] Record image digests + Helm revision in change ticket

## Rollback decision

- [ ] Criteria: migrate failed, crash loop, VIP down, 5xx spike, smoke FAIL
- [ ] App rollback: `helm rollback <release> <revision>` — **OPERATOR**
- [ ] Schema rollback: restore Postgres from backup to **isolated** DB first; promote only after smoke — **OPERATOR**
- [ ] Kong: revert previous declarative config on `.209` — **OPERATOR**
- [ ] Communicate incident severity per `docs/K8S-OPS.md`

## Sign-off

| Role          | Name | Date | Notes         |
| ------------- | ---- | ---- | ------------- |
| Release owner |      |      |               |
| DB owner      |      |      | backup id     |
| Gateway owner |      |      | Kong revision |

## Related scripts

```powershell
.\scripts\deploy-preflight.ps1 -DryRun
.\scripts\smoke-release.ps1 -DryRun
.\scripts\validate-production.ps1
.\scripts\check-secret-leak.ps1
.\scripts\backup-postgres.ps1   # dry-run default
```
