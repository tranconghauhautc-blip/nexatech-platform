#!/usr/bin/env bash
# NexaTech production preflight / validation (safe unattended + operator health checks).
#
# Usage:
#   ./scripts/validate-production.sh              # dry-run friendly
#   ./scripts/validate-production.sh --strict     # fail on BLOCKED health URLs
#   ENTRY_VIP=192.168.4.204 ./scripts/validate-production.sh
#   BASE_URL=https://shop.example.com ./scripts/validate-production.sh
#
# Does NOT mutate cluster. Does NOT print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART="${ROOT}/deploy/helm/nexatech"
KONG_PROD="${ROOT}/infra/kong/kong.production.yml"
SECRET_EXAMPLE="${CHART}/secret-values.example.yaml"
STRICT=0
FAILURES=0
BLOCKED=0
WARNINGS=0

usage() {
  cat <<'EOF'
Usage: validate-production.sh [--strict | --dry-run]

  --strict    Treat unreachable health URLs as failure (default: BLOCKED warning)
  --dry-run   Same as default — lint/template only; health checks best-effort
  -h, --help  Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) STRICT=1; shift ;;
    --dry-run) shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

ENTRY_VIP="${ENTRY_VIP:-192.168.4.204}"
BASE_URL="${BASE_URL:-}"

log() { echo "[validate-production] $*"; }
pass() { log "PASS: $*"; }
fail() { log "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { log "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
blocked() { log "BLOCKED: $*"; BLOCKED=$((BLOCKED + 1)); }

log "NexaTech production validation (repo=${ROOT})"
log "ENTRY_VIP=${ENTRY_VIP} BASE_URL=${BASE_URL:-<not set>} STRICT=${STRICT}"

# --- Operator preflight (document only) ---
log "--- Operator preflight (run manually before any mutate) ---"
log "  kubectl config current-context"
log "  kubectl cluster-info"
log "  kubectl get nodes -o wide"
log "  Confirm context is PRODUCTION before helm upgrade / kubectl apply"

# --- Helm lint / template ---
if command -v helm >/dev/null 2>&1; then
  log "--- Helm lint ---"
  if helm lint "$CHART" >/dev/null; then
    pass "helm lint ${CHART}"
  else
    fail "helm lint ${CHART}"
    helm lint "$CHART" || true
  fi

  log "--- Helm template (values-production) ---"
  if helm template nexatech "$CHART" \
    -f "${CHART}/values-production.yaml" \
    --namespace nexatech >/dev/null 2>&1; then
    pass "helm template values-production.yaml"
  else
    fail "helm template values-production.yaml"
    helm template nexatech "$CHART" -f "${CHART}/values-production.yaml" --namespace nexatech >/dev/null || true
  fi
else
  blocked "helm not in PATH — skip lint/template (install helm or use .tools/bin/helm)"
fi

# --- Kong production config ---
log "--- Kong declarative config ---"
if [[ -f "$KONG_PROD" ]]; then
  pass "found ${KONG_PROD}"
  if grep -q '192.168.4.204' "$KONG_PROD"; then
    pass "kong.production.yml references MetalLB VIP 192.168.4.204"
  else
    fail "kong.production.yml missing expected VIP 192.168.4.204"
  fi
else
  fail "missing ${KONG_PROD}"
fi

# --- Expected Secret keys (names only) ---
log "--- Expected Secret keys (names only, not values) ---"
EXPECTED_KEYS=(
  jwt-access-secret jwt-refresh-secret admin-session-secret
  identity-database-url customer-database-url catalog-database-url media-database-url
  inventory-database-url cart-database-url order-database-url payment-database-url
  shipping-database-url review-database-url warranty-database-url support-database-url
  notification-database-url reporting-database-url
  redis-url rabbitmq-url rabbitmq-user rabbitmq-password
  minio-access-key minio-secret-key
)

if [[ -f "$SECRET_EXAMPLE" ]]; then
  pass "found secret-values.example.yaml"
  for key in "${EXPECTED_KEYS[@]}"; do
    if grep -q "${key}:" "$SECRET_EXAMPLE" || grep -q "# ${key}:" "$SECRET_EXAMPLE"; then
      pass "secret key documented: ${key}"
    else
      warn "secret key not found in example: ${key}"
    fi
  done
else
  fail "missing ${SECRET_EXAMPLE}"
fi

# --- Health URL checks ---
log "--- Health endpoints ---"

check_url() {
  local name="$1"
  local url="$2"
  if curl -sf --connect-timeout 5 --max-time 15 "$url" >/dev/null 2>&1; then
    pass "${name} ${url}"
    return 0
  fi
  if [[ "$STRICT" -eq 1 ]]; then
    fail "${name} unreachable: ${url}"
  else
    blocked "${name} unreachable (network/agent): ${url}"
  fi
  return 1
}

# VIP-based internal checks
check_url "entry healthz" "http://${ENTRY_VIP}/healthz"
check_url "identity live" "http://${ENTRY_VIP}:3001/health/live"
check_url "identity ready" "http://${ENTRY_VIP}:3001/health/ready"
check_url "catalog ready" "http://${ENTRY_VIP}:3003/health/ready"
check_url "storefront" "http://${ENTRY_VIP}/"
check_url "admin" "http://${ENTRY_VIP}:3100/"

# Public BASE_URL checks (via Kong/ADC — often BLOCKED from dev machine)
if [[ -n "$BASE_URL" ]]; then
  base="${BASE_URL%/}"
  check_url "public storefront" "${base}/"
  check_url "public api catalog" "${base}/api/v1/catalog/products?page=1&limit=1"
else
  log "BASE_URL not set — skip public URL checks (set BASE_URL for Kong/ADC smoke)"
fi

# --- Summary ---
log "--- Summary ---"
log "Failures: ${FAILURES}  Blocked: ${BLOCKED}  Warnings: ${WARNINGS}"

if [[ "$FAILURES" -gt 0 ]]; then
  log "Result: FAILED"
  exit 1
fi

if [[ "$BLOCKED" -gt 0 && "$STRICT" -eq 1 ]]; then
  log "Result: FAILED (strict + blocked checks)"
  exit 1
fi

if [[ "$BLOCKED" -gt 0 ]]; then
  log "Result: OK with BLOCKED items (dry-run friendly — operator re-run from prod network)"
  exit 0
fi

log "Result: OK"
exit 0
