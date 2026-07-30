#!/usr/bin/env bash
# Scan repository for accidental secret/password leaks.
# Excludes examples, placeholders, and documentation patterns.
#
# Usage:
#   ./scripts/check-secret-leak.sh
#   ./scripts/check-secret-leak.sh --path .
#
# Exit 0 = clean, 1 = potential leaks found
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATH="${ROOT}"
FAIL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path) SCAN_PATH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: check-secret-leak.sh [--path DIR]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

log() { echo "[check-secret-leak] $*"; }

# Files/dirs to skip
EXCLUDES=(
  --glob '!**/.git/**'
  --glob '!**/node_modules/**'
  --glob '!**/dist/**'
  --glob '!**/.nx/**'
  --glob '!**/.tools/**'
  --glob '!**/src/generated/**'
  --glob '!**/coverage/**'
  --glob '!**/pnpm-lock.yaml'
  --glob '!**/*.png' --glob '!**/*.jpg' --glob '!**/*.jpeg'
  --glob '!**/*.gif' --glob '!**/*.webp' --glob '!**/*.ico'
  --glob '!**/*.woff' --glob '!**/*.woff2'
  --glob '!**/*.node' --glob '!**/*.dll' --glob '!**/*.so' --glob '!**/*.wasm'
  --glob '!**/.env.nx'
  --glob '!**/check-secret-leak.sh'
  --glob '!**/check-secret-leak.ps1'
)

# Safe placeholder lines (skip if matched)
is_safe_line() {
  local line="$1"
  [[ "$line" =~ CHANGE_ME ]] && return 0
  [[ "$line" =~ REPLACE ]] && return 0
  [[ "$line" =~ PASSWORD ]] && return 0
  [[ "$line" =~ changeme ]] && return 0
  [[ "$line" =~ change-me ]] && return 0
  [[ "$line" =~ YOUR_ ]] && return 0
  [[ "$line" =~ EXAMPLE ]] && return 0
  [[ "$line" =~ example\.yaml ]] && return 0
  [[ "$line" =~ secret-values\.example ]] && return 0
  [[ "$line" =~ \*\*\* ]] && return 0
  [[ "$line" =~ '<redacted>' ]] && return 0
  [[ "$line" =~ '\.\.\.@' ]] && return 0
  [[ "$line" =~ ^[[:space:]]*# ]] && return 0
  return 1
}

if ! command -v rg >/dev/null 2>&1; then
  log "ERROR: ripgrep (rg) required"
  exit 1
fi

log "Scanning ${SCAN_PATH} ..."

# Explicit checks with rg
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  file="${hit%%:*}"
  rest="${hit#*:}"
  line_num="${rest%%:*}"
  content="${rest#*:}"

  if is_safe_line "$content"; then
    continue
  fi

  log "POTENTIAL LEAK: ${file}:${line_num}"
  log "  ${content}"
  FAIL=1
done < <(rg -n --no-heading -i \
  -e 'postgresql://nexatech_[a-z_]+:[^@"\s]+@192\.168\.' \
  -e 'PGPASSWORD=[^"\s]+' \
  -e 'password\s*=\s*["\'][^"\']{8,}["\']' \
  -e 'secret[_-]?key\s*=\s*["\'][A-Za-z0-9+/=]{20,}["\']' \
  -e 'BEGIN PRIVATE KEY' \
  -e 'AKIA[0-9A-Z]{16}' \
  "${EXCLUDES[@]}" "$SCAN_PATH" 2>/dev/null || true)

# Blocked: .env files tracked in git (except .env.example)
while IFS= read -r envfile; do
  [[ -z "$envfile" ]] && continue
  case "$envfile" in
    *.example|*.sample|*.template|.env.nx|*/.env.nx) continue ;;
  esac
  if git -C "$ROOT" ls-files --error-unmatch "$envfile" >/dev/null 2>&1; then
    log "TRACKED ENV FILE: ${envfile} (should be gitignored)"
    FAIL=1
  fi
done < <(find "$SCAN_PATH" -name '.env*' -type f 2>/dev/null || true)

if [[ "$FAIL" -eq 0 ]]; then
  log "OK: no high-confidence secret leaks detected"
  exit 0
else
  log "FAILED: review findings above — remove or rotate exposed secrets"
  exit 1
fi
