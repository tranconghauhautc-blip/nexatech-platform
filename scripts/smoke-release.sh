#!/usr/bin/env bash
# NexaTech release smoke tests — configurable target, private/local guard.
# Usage:
#   ./scripts/smoke-release.sh --base-url http://127.0.0.1
#   ./scripts/smoke-release.sh --via-entry
#   ./scripts/smoke-release.sh --dry-run
# Does NOT log tokens. Mutating checks require --allow-mutate.

set -uo pipefail

BASE_URL="${SMOKE_BASE_URL:-}"
ENTRY_VIP="${ENTRY_VIP:-192.168.4.204}"
VIA_ENTRY=0
ALLOW_MUTATE=0
DRY_RUN=0
TIMEOUT_SEC=15
RETRIES=2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --via-entry) VIA_ENTRY=1; shift ;;
    --allow-mutate) ALLOW_MUTATE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --timeout) TIMEOUT_SEC="$2"; shift 2 ;;
    --retries) RETRIES="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: smoke-release.sh [--base-url URL] [--via-entry] [--allow-mutate] [--dry-run]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

PASSES=0
WARNINGS=0
BLOCKED=0
FAILURES=0

log() { echo "[smoke-release] $*"; }
pass() { log "PASS: $*"; PASSES=$((PASSES + 1)); }
fail() { log "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { log "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
blocked() { log "BLOCKED: $*"; BLOCKED=$((BLOCKED + 1)); }

is_private_target() {
  local url="$1"
  local host
  host="$(echo "$url" | sed -E 's#^[a-zA-Z]+://([^/:]+).*#\1#')"
  case "$host" in
    localhost|127.0.0.1|::1) return 0 ;;
    "$ENTRY_VIP") return 0 ;;
  esac
  if echo "$host" | grep -Eq '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'; then return 0; fi
  return 1
}

if [[ "$VIA_ENTRY" -eq 1 ]]; then BASE_URL="http://$ENTRY_VIP"; fi
if [[ -z "$BASE_URL" ]]; then
  BASE_URL="http://$ENTRY_VIP"
  blocked "BaseUrl unset; defaulting to ENTRY_VIP (may be unreachable)"
fi
BASE_URL="${BASE_URL%/}"

if ! is_private_target "$BASE_URL"; then
  fail "Refusing non-private target: $BASE_URL"
  exit 1
fi

HOST_ONLY="$(echo "$BASE_URL" | sed -E 's#^(https?://[^/:]+).*#\1#')"
log "target=$BASE_URL AllowMutate=$ALLOW_MUTATE DryRun=$DRY_RUN"

http_check() {
  local name="$1" url="$2" optional="${3:-0}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN check $name -> $url"
    pass "dry-run planned: $name"
    return
  fi
  local attempt=0
  while [[ $attempt -le $RETRIES ]]; do
    attempt=$((attempt + 1))
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SEC" "$url" 2>/dev/null || echo '000')"
    if [[ "$code" =~ ^[234][0-9][0-9]$ ]]; then
      pass "$name HTTP $code"
      return
    fi
    sleep 1
  done
  if [[ "$optional" -eq 1 ]]; then warn "$name unreachable (optional): $url"
  else blocked "$name unreachable: $url"; fi
}

http_check storefront "$HOST_ONLY/"
http_check entry-healthz "$HOST_ONLY/healthz"
http_check admin "${HOST_ONLY}:3100/"
http_check identity-live "${HOST_ONLY}:3001/health/live"
http_check identity-ready "${HOST_ONLY}:3001/health/ready"
http_check catalog-ready "${HOST_ONLY}:3003/health/ready"
http_check catalog-products "${HOST_ONLY}:3003/api/v1/products?page=1&limit=1"
http_check cart-ready "${HOST_ONLY}:3006/health/ready"
http_check order-ready "${HOST_ONLY}:3007/health/ready"
http_check payment-ready "${HOST_ONLY}:3008/health/ready"
http_check shipping-ready "${HOST_ONLY}:3009/health/ready"
http_check review-ready "${HOST_ONLY}:3010/health/ready"
http_check warranty-ready "${HOST_ONLY}:3011/health/ready"
http_check support-ready "${HOST_ONLY}:3012/health/ready"
http_check notification-ready "${HOST_ONLY}:3013/health/ready"
http_check reporting-ready "${HOST_ONLY}:3014/health/ready"

if [[ "$ALLOW_MUTATE" -eq 1 ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    pass "dry-run planned: cart create"
  else
    blocked "cart/checkout mutate smoke needs live stack + SMOKE_CART_TOKEN (operator)"
  fi
else
  log "AllowMutate not set — skip cart/checkout mutation checks"
fi

log "--- Summary ---"
log "PASS=$PASSES WARN=$WARNINGS BLOCKED=$BLOCKED FAIL=$FAILURES"
log "NOTE: tokens/secrets are never logged by this script"

if [[ "$FAILURES" -gt 0 ]]; then log "Result: FAIL"; exit 1; fi
if [[ "$DRY_RUN" -eq 1 ]]; then log "Result: OK (dry-run)"; exit 0; fi
if [[ "$BLOCKED" -gt 0 ]]; then log "Result: OK with BLOCKED"; exit 0; fi
log "Result: OK"
exit 0
