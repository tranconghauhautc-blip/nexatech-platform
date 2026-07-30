# Backup & Restore — NexaTech M18

Operator runbook for production data protection. **Agent unattended MUST NOT restore into live production or run destructive SQL.**

## Scope

| Component            | Location                   | Backup method                                             |
| -------------------- | -------------------------- | --------------------------------------------------------- |
| PostgreSQL (14 DBs)  | VM `192.168.4.208`         | `pg_dump` per database + SHA-256 checksum                 |
| MinIO object storage | In-cluster PVC / ClusterIP | `mc mirror` to off-cluster bucket                         |
| RabbitMQ             | In-cluster PVC             | Definitions export (`rabbitmqadmin` / HTTP API)           |
| K8s Secrets / config | Cluster `nexatech`         | Encrypted off-repo export (Sealed Secrets / SOPS / vault) |

## Safety rules (mandatory)

1. **NEVER** restore a backup into live production from an unattended agent or automated script without explicit operator approval and a written change ticket.
2. **NEVER** run `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, `prisma migrate reset`, or `prisma db push` against production.
3. Restore validation **only** on a **separate test database** (different host or `_restore_test` suffix DB on `.208` with isolated credentials).
4. After restore drill, drop or quarantine the test DB — do not point application Secrets at it.
5. Backup artifacts containing credentials or PII must be encrypted at rest and access-controlled.

## PostgreSQL — VM `192.168.4.208`

### Databases (one dump file per DB)

| Database                | App user (backup role)  |
| ----------------------- | ----------------------- |
| `nexatech_identity`     | `nexatech_identity`     |
| `nexatech_customer`     | `nexatech_customer`     |
| `nexatech_catalog`      | `nexatech_catalog`      |
| `nexatech_media`        | `nexatech_media`        |
| `nexatech_inventory`    | `nexatech_inventory`    |
| `nexatech_cart`         | `nexatech_cart`         |
| `nexatech_order`        | `nexatech_order`        |
| `nexatech_payment`      | `nexatech_payment`      |
| `nexatech_shipping`     | `nexatech_shipping`     |
| `nexatech_review`       | `nexatech_review`       |
| `nexatech_warranty`     | `nexatech_warranty`     |
| `nexatech_support`      | `nexatech_support`      |
| `nexatech_notification` | `nexatech_notification` |
| `nexatech_reporting`    | `nexatech_reporting`    |

Use a dedicated **backup role** with `CONNECT` + `SELECT` on all tables (or per-DB read-only user). Do **not** use the superuser `postgres` role for scheduled dumps unless required for extensions — prefer least privilege.

### Scripts

| Script                        | OS                                |
| ----------------------------- | --------------------------------- |
| `scripts/backup-postgres.sh`  | Bash (Linux VM / cron)            |
| `scripts/backup-postgres.ps1` | PowerShell (operator workstation) |

Both default to **dry-run**. Pass `--execute` (bash) or `-Execute` (PowerShell) to write dumps.

Environment variables:

| Variable                | Default                               | Description                                |
| ----------------------- | ------------------------------------- | ------------------------------------------ |
| `PGHOST`                | `192.168.4.208`                       | PostgreSQL host                            |
| `PGPORT`                | `5432`                                | Port                                       |
| `PGUSER`                | `nexatech_backup`                     | Backup user                                |
| `PGPASSWORD`            | _(required for execute)_              | Read from env only — never in repo         |
| `BACKUP_DIR`            | `/var/backups/nexatech/postgres`      | Output directory                           |
| `RETENTION_DAYS`        | `14`                                  | Delete dumps + checksums older than N days |
| `NEXATECH_PG_DATABASES` | all 14 DBs (comma-separated override) | Optional subset                            |

Each successful dump produces:

```text
BACKUP_DIR/YYYY-MM-DD/nexatech_identity_20260730T020000.sql.gz
BACKUP_DIR/YYYY-MM-DD/nexatech_identity_20260730T020000.sql.gz.sha256
```

### Manual dump (reference)

```bash
export PGHOST=192.168.4.208 PGUSER=nexatech_backup PGPASSWORD='***'
pg_dump -Fc --no-owner --no-acl nexatech_identity \
  | gzip > nexatech_identity_$(date +%Y%m%dT%H%M%S).sql.gz
sha256sum nexatech_identity_*.sql.gz > nexatech_identity_*.sql.gz.sha256
```

### Retention policy

| Tier    | Retention | Storage                                                 |
| ------- | --------- | ------------------------------------------------------- |
| Daily   | 14 days   | Local `/var/backups/nexatech/postgres` on `.208` or NFS |
| Weekly  | 8 weeks   | Copy Sunday dump to secondary NAS / object store        |
| Monthly | 12 months | Encrypted off-site (S3-compatible / tape)               |

Scripts apply daily retention via `find … -mtime +${RETENTION_DAYS}` when `-Execute` / `--execute` is set.

### Schedule example (cron on `.208` or backup jump host)

```cron
# NexaTech PostgreSQL backup — 02:15 daily (Asia/Ho_Chi_Minh)
15 2 * * * PGHOST=192.168.4.208 PGUSER=nexatech_backup \
  /opt/nexatech/scripts/backup-postgres.sh --execute \
  >> /var/log/nexatech/backup-postgres.log 2>&1
```

Store `PGPASSWORD` in `/etc/nexatech/backup.env` (`chmod 600`, root-owned) and `source` it from cron — **never** commit passwords.

### Restore validation (test DB only)

**Prerequisites:** empty test database, e.g. `nexatech_identity_restore_test`, owned by a test user. Production Secret must **not** reference this DB.

```bash
# 1) Verify checksum
sha256sum -c nexatech_identity_20260730T020000.sql.gz.sha256

# 2) Restore into TEST database only
gunzip -c nexatech_identity_20260730T020000.sql.gz \
  | pg_restore -d nexatech_identity_restore_test --no-owner --no-acl --clean --if-exists

# 3) Validate row counts / schema version
psql -d nexatech_identity_restore_test -c "SELECT COUNT(*) FROM \"User\";"
psql -d nexatech_identity_restore_test -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# 4) Drop test DB when done (operator only)
# psql -c "DROP DATABASE nexatech_identity_restore_test;"
```

**Production cutover restore** (disaster only): stop traffic → restore each DB from latest verified backup → run migrate verify → smoke test → resume. Requires change window and **manual** operator steps documented in `docs/K8S-OPS.md` § Disaster recovery.

## MinIO backup

MinIO runs in-cluster (ClusterIP). Backup from a pod or jump host with `mc` (MinIO Client).

```bash
# One-time alias (credentials from K8s Secret — operator supplies)
mc alias set nexatech-prod http://nexatech-minio.nexatech.svc:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

# Mirror to off-cluster target (versioned bucket recommended)
mc mirror --overwrite --remove nexatech-prod/nexatech-media /backup/minio/nexatech-media/$(date +%F)
# Or remote: mc mirror nexatech-prod/nexatech-media backup-remote/nexatech-media
```

Schedule: daily incremental mirror; weekly full sync. Retention on destination bucket: 30 days lifecycle rule.

**Restore:** mirror back to a **staging** MinIO or prefix — never overwrite production bucket without freeze window.

## RabbitMQ definitions export

Export users, vhosts, exchanges, queues, bindings (not message backlog — use shovel/federation for DR messaging if required).

```bash
# From management plugin (ClusterIP — port-forward or in-cluster curl)
kubectl -n nexatech port-forward svc/nexatech-rabbitmq 15672:15672 &
curl -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" \
  http://127.0.0.1:15672/api/definitions \
  -o rabbitmq-definitions-$(date +%F).json
```

Or:

```bash
rabbitmqadmin -H nexatech-rabbitmq.nexatech.svc -u nexatech -p "$RABBITMQ_PASSWORD" export /backup/rabbitmq/definitions.json
```

Store exports encrypted off-repo. Message persistence is on PVC — snapshot PVC per `docs/K8S-OPS.md` if RPO requires queued message recovery.

## Kubernetes Secrets and configuration backup

**Never commit plaintext Secrets to git.**

| Method                                                           | Use case                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) | Encrypt Secret manifests; safe in private git                                        |
| [SOPS](https://github.com/getsops/sops) + age/PGP                | Encrypted `secret-values.yaml` in private repo                                       |
| External Secrets Operator                                        | Sync from Vault / cloud KMS                                                          |
| Manual export                                                    | `kubectl get secret nexatech-secrets -n nexatech -o yaml` → encrypt → store off-repo |

Backup checklist (operator, monthly):

1. Export SealedSecret / encrypted SOPS files from git tag matching deployed Helm revision.
2. Document Helm values overlays (`values-production.yaml` + private `-f secret-values.yaml`).
3. Export non-secret ConfigMaps: `kubectl get configmap -n nexatech -o yaml`.
4. Record `IMAGE_TAG`, chart version, and Kong declarative file hash (`infra/kong/kong.production.yml`).

Restore order: namespace → Secrets → ConfigMaps → Helm release → verify migrate Jobs → Kong apply.

## Monitoring backup health

- Cron exit code non-zero → alert (email/Prometheus alertmanager).
- Daily check: newest dump age `< 26h`, checksum file present, file size within expected band.
- Monthly restore drill on test DB (catalog + identity minimum).

## Related documents

- `docs/MIGRATIONS.md` — schema deploy; rollback via restore not ad-hoc down migrations
- `docs/K8S-OPS.md` — PVC snapshot, disaster recovery
- `docs/DISASTER-RECOVERY.md` — RPO/RTO draft (M20)
- `docs/DEPLOY-RUNBOOK-PRODUCTION.md` — deploy order
- `scripts/backup-postgres.sh` / `scripts/backup-postgres.ps1`
- `scripts/backup-restore-validate.ps1` / `.sh` — isolated dry-run gate (never prod DB)
