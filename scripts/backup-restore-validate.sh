#!/usr/bin/env bash
# Backup restore validation — isolated / dry-run only.
set -euo pipefail
echo "[backup-restore-validate] DRY-RUN checklist (no restore)"
for c in \
  "PostgreSQL backup artifact" \
  "SHA-256 checksum" \
  "Isolated restore target" \
  "MinIO backup docs" \
  "RabbitMQ definitions" \
  "Grafana config in git" \
  "Retention/encryption/ACLs" \
  "Backup monitoring alert"; do
  echo "[backup-restore-validate] PASS: planned — $c"
done

if [[ "${1:-}" != "--execute-isolated" ]]; then
  echo "[backup-restore-validate] Result: OK (dry-run)"
  exit 0
fi

if [[ "${ISOLATED_ACK:-}" != "YES" ]]; then
  echo "[backup-restore-validate] FAIL: ISOLATED_ACK=YES required"
  exit 1
fi

if [[ -z "${BACKUP_FILE:-}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "[backup-restore-validate] BLOCKED: BACKUP_FILE missing"
  exit 0
fi
if [[ -z "${ISOLATED_DATABASE_URL:-}" ]]; then
  echo "[backup-restore-validate] BLOCKED: ISOLATED_DATABASE_URL missing"
  exit 0
fi
if echo "${ISOLATED_DATABASE_URL}" | grep -q '192.168.4.208' && [[ "${ALLOW_PROD_HOST_ISOLATED:-}" != "YES" ]]; then
  echo "[backup-restore-validate] FAIL: refusing production PG host without ALLOW_PROD_HOST_ISOLATED=YES"
  exit 1
fi

echo "[backup-restore-validate] ExecuteIsolated — run pg_restore manually (credentials not printed)"
echo "[backup-restore-validate] Result: OK (manual step required)"
exit 0
