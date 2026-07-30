# Disaster Recovery — NexaTech (M20)

> **Assumptions draft — operator must confirm RPO/RTO before go-live.**

## RPO / RTO draft

| Component            | RPO draft               | RTO draft | Notes                                               |
| -------------------- | ----------------------- | --------- | --------------------------------------------------- |
| PostgreSQL (14 DBs)  | 24h (daily `pg_dump`)   | 4h        | Prefer PITR later; restore to **isolated** DB first |
| MinIO                | 24h mirror/backup       | 8h        | Bucket versioning optional                          |
| RabbitMQ             | Best-effort definitions | 2h        | Message loss acceptable if outbox replayed          |
| Redis                | Ephemeral               | 1h        | Sessions re-login                                   |
| Kubernetes manifests | Git HEAD                | 2h        | Helm chart + values                                 |
| Secrets              | Offline vault copy      | 2h        | Never in git                                        |
| Observability        | Config in git           | 4h        | Metrics retention not DR-critical                   |

## Backup validation

| Step                                              | Unattended allowed?      |
| ------------------------------------------------- | ------------------------ |
| `backup-postgres` dry-run                         | Yes                      |
| Execute dump to operator path                     | Operator                 |
| Restore into **isolated** test database/container | Yes if disposable        |
| Restore into current prod DB                      | **Forbidden** unattended |
| Checksum verify                                   | Yes                      |
| Restore smoke (migrate status / select 1)         | Isolated only            |

Scripts:

- `scripts/backup-postgres.ps1|.sh`
- `scripts/backup-restore-validate.ps1|.sh` (isolated dry-run / optional container)

## Order of recovery

1. Secrets + kube access
2. PostgreSQL restore (isolated verify → promote)
3. Platform Redis/RabbitMQ/MinIO
4. Migrate deploy (if schema behind)
5. Helm apps
6. MetalLB VIP / Kong
7. Smoke + preflight

## Related

- `docs/BACKUP-RESTORE.md`
- `docs/INCIDENT-RESPONSE.md`
- `docs/K8S-OPS.md`
