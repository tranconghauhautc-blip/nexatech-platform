#!/usr/bin/env bash
# NexaTech PostgreSQL backup — pg_dump per DB + SHA-256 checksum.
# Default: DRY-RUN (no writes). Pass --execute to run dumps.
#
# Usage:
#   ./scripts/backup-postgres.sh              # dry-run
#   ./scripts/backup-postgres.sh --execute    # real backup
#   PGHOST=192.168.4.208 ./scripts/backup-postgres.sh --execute
#
# Env:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD (required for --execute)
#   BACKUP_DIR (default: /var/backups/nexatech/postgres)
#   RETENTION_DAYS (default: 14)
#   NEXATECH_PG_DATABASES (comma-separated; default: all 14 app DBs)
#
# NEVER commit PGPASSWORD. NEVER restore to prod from unattended automation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXECUTE=0
DRY_RUN=1

usage() {
  cat <<'EOF'
Usage: backup-postgres.sh [--execute | --dry-run]

  --execute   Run pg_dump and write checksum files (requires PGPASSWORD)
  --dry-run   Print planned actions only (default)
  -h, --help  Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1; DRY_RUN=0; shift ;;
    --dry-run) EXECUTE=0; DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

PGHOST="${PGHOST:-192.168.4.208}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-nexatech_backup}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nexatech/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

DEFAULT_DBS="nexatech_identity,nexatech_customer,nexatech_catalog,nexatech_media,nexatech_inventory,nexatech_cart,nexatech_order,nexatech_payment,nexatech_shipping,nexatech_review,nexatech_warranty,nexatech_support,nexatech_notification,nexatech_reporting"
IFS=',' read -r -a DATABASES <<< "${NEXATECH_PG_DATABASES:-$DEFAULT_DBS}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DATE_DIR="$(date -u +%Y-%m-%d)"
OUT_DIR="${BACKUP_DIR}/${DATE_DIR}"

log() { echo "[backup-postgres] $*"; }
fail() { echo "[backup-postgres] ERROR: $*" >&2; exit 1; }

if [[ "$EXECUTE" -eq 1 ]]; then
  command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found in PATH"
  command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || fail "sha256sum/shasum not found in PATH"
  [[ -n "${PGPASSWORD:-}" ]] || fail "PGPASSWORD must be set for --execute"
  export PGHOST PGPORT PGUSER PGPASSWORD
  mkdir -p "$OUT_DIR"
else
  log "DRY-RUN mode (pass --execute to write backups)"
  if ! command -v pg_dump >/dev/null 2>&1; then
    log "NOTE: pg_dump not in PATH (OK for dry-run; required for --execute)"
  fi
fi

log "Host=${PGHOST}:${PGPORT} User=${PGUSER} Dir=${OUT_DIR} Retention=${RETENTION_DAYS}d Databases=${#DATABASES[@]}"

for db in "${DATABASES[@]}"; do
  [[ -n "$db" ]] || continue
  base="${db}_${TS}.sql.gz"
  dump_path="${OUT_DIR}/${base}"
  sum_path="${dump_path}.sha256"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] pg_dump -Fc ${db} | gzip > ${dump_path}"
    log "[dry-run] sha256sum > ${sum_path}"
    continue
  fi

  log "Dumping ${db}..."
  if ! pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" \
    --no-owner --no-acl -Fc 2>/dev/null | gzip -c > "$dump_path"; then
    fail "pg_dump failed for database: ${db}"
  fi

  if [[ ! -s "$dump_path" ]]; then
    fail "Dump file empty: ${dump_path}"
  fi

  (cd "$(dirname "$dump_path")" && sha256sum "$(basename "$dump_path")" > "$(basename "$sum_path")")
  log "OK ${db} -> ${dump_path} ($(wc -c < "$dump_path") bytes)"
done

if [[ "$EXECUTE" -eq 1 && "$RETENTION_DAYS" -gt 0 ]]; then
  log "Pruning backups older than ${RETENTION_DAYS} days under ${BACKUP_DIR}..."
  find "$BACKUP_DIR" -type f \( -name '*.sql.gz' -o -name '*.sql.gz.sha256' \) -mtime +"$RETENTION_DAYS" -print -delete || true
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry-run complete. No files written."
else
  log "Backup complete."
fi
