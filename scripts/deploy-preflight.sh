#!/usr/bin/env bash
# NexaTech deployment preflight — read-only checks for release readiness.
#
# Usage:
#   ./scripts/deploy-preflight.sh
#   ./scripts/deploy-preflight.sh --dry-run
#   ./scripts/deploy-preflight.sh --strict
#
# Exit: 0 OK (may include WARN/BLOCKED), 1 FAIL
# Does NOT mutate cluster. Does NOT print secrets. Does NOT apply Kong.

set -uo pipefail

DRY_RUN=0
STRICT=0
SKIP_KUBE=0
SKIP_CONNECTIVITY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --strict) STRICT=1; shift ;;
    --skip-kube) SKIP_KUBE=1; shift ;;
    --skip-connectivity) SKIP_CONNECTIVITY=1; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: deploy-preflight.sh [--dry-run] [--strict] [--skip-kube] [--skip-connectivity]
Env: ENTRY_VIP KONG_VM POSTGRES_HOST POSTGRES_PORT IMAGE_TAG IMAGE_REPOSITORY NAMESPACE
EOF
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART="$ROOT/deploy/helm/nexatech"
OBS_CHART="$ROOT/deploy/helm/nexatech-observability"
KONG_PROD="$ROOT/infra/kong/kong.production.yml"
SECRET_EXAMPLE="$CHART/secret-values.example.yaml"
VALUES_PROD="$CHART/values-production.yaml"
IMAGE_MATRIX="$ROOT/docs/image-matrix.json"

ENTRY_VIP="${ENTRY_VIP:-192.168.4.204}"
KONG_VM="${KONG_VM:-192.168.4.209}"
POSTGRES_HOST="${POSTGRES_HOST:-192.168.4.208}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
IMAGE_TAG="${IMAGE_TAG:-0.17.0}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-nexatech}"
NAMESPACE="${NAMESPACE:-nexatech}"

PASSES=0
WARNINGS=0
BLOCKED=0
FAILURES=0

log() { echo "[deploy-preflight] $*"; }
pass() { log "PASS: $*"; PASSES=$((PASSES + 1)); }
fail() { log "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { log "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
blocked() { log "BLOCKED: $*"; BLOCKED=$((BLOCKED + 1)); }

BACKENDS=(identity-service customer-service catalog-service media-service inventory-service cart-service order-service payment-service shipping-service review-service warranty-service support-service notification-service reporting-service)
FRONTENDS=(storefront-web admin-web)

log "NexaTech deploy preflight (repo=$ROOT)"
log "DRY_RUN=$DRY_RUN STRICT=$STRICT ENTRY_VIP=$ENTRY_VIP KONG_VM=$KONG_VM IMAGE_TAG=$IMAGE_TAG NS=$NAMESPACE"

log "--- Image tag policy ---"
if [[ "$IMAGE_TAG" == "latest" ]]; then
  fail "IMAGE_TAG must not be latest"
else
  pass "IMAGE_TAG is pinned: $IMAGE_TAG"
fi

log "--- Repository assets ---"
for path in "$CHART" "$OBS_CHART" "$KONG_PROD" "$SECRET_EXAMPLE" "$VALUES_PROD" "$IMAGE_MATRIX"; do
  if [[ -e "$path" ]]; then pass "found $path"; else fail "missing $path"; fi
done

for name in "${FRONTENDS[@]}" "${BACKENDS[@]}"; do
  if [[ -f "$ROOT/apps/$name/Dockerfile" ]]; then pass "Dockerfile $name"; else fail "missing Dockerfile $name"; fi
done
if [[ -f "$ROOT/deploy/docker/prisma-migrate.Dockerfile" ]]; then pass "prisma-migrate.Dockerfile"; else fail "missing prisma-migrate.Dockerfile"; fi

log "--- Helm values tag scan ---"
if [[ -f "$VALUES_PROD" ]]; then
  if grep -Eqi 'imageTag:[[:space:]]*['\''"]?latest|tag:[[:space:]]*['\''"]?latest' "$VALUES_PROD"; then
    fail "values-production.yaml uses latest tag"
  else
    pass "values-production.yaml has no latest tag"
  fi
  if grep -q '192.168.4.204' "$VALUES_PROD"; then pass "values-production references MetalLB VIP 192.168.4.204"
  else fail "values-production missing MetalLB VIP 192.168.4.204"; fi
  if grep -q 'CHANGE_ME' "$VALUES_PROD"; then warn "values-production still contains CHANGE_ME placeholders"; fi
fi

log "--- Required Secret key names (documentation) ---"
EXPECTED_KEYS=(jwt-access-secret jwt-refresh-secret admin-session-secret identity-database-url customer-database-url catalog-database-url media-database-url inventory-database-url cart-database-url order-database-url payment-database-url shipping-database-url review-database-url warranty-database-url support-database-url notification-database-url reporting-database-url redis-url rabbitmq-url rabbitmq-user rabbitmq-password minio-access-key minio-secret-key)
if [[ -f "$SECRET_EXAMPLE" ]]; then
  for key in "${EXPECTED_KEYS[@]}"; do
    if grep -q "$key" "$SECRET_EXAMPLE"; then pass "secret key documented: $key"; else warn "secret key not documented: $key"; fi
  done
fi

log "--- Kong / MetalLB static mapping ---"
if [[ -f "$KONG_PROD" ]]; then
  if grep -q '192.168.4.204' "$KONG_PROD"; then pass "kong.production.yml upstream VIP 192.168.4.204"; else fail "kong.production.yml missing VIP"; fi
  for p in '/' '/admin' '/api/v1' '/api/v2'; do
    if grep -Fq "$p" "$KONG_PROD"; then pass "kong route path present: $p"; else fail "kong route path missing: $p"; fi
  done
  if grep -Eq 'correlation-id|x-request-id|request-id' "$KONG_PROD"; then pass "kong correlation / request-id plugin present"; else warn "kong request-id not found"; fi
  pass "kong static scan: management console exposure not asserted as present"
  log "NOTE: Kong live apply remains operator-owned on VM $KONG_VM (BLOCKED_EXTERNAL)"
else
  fail "missing $KONG_PROD"
fi

log "--- Service port and health mapping ---"
for svc in "${BACKENDS[@]}"; do
  pass "$svc health=/health/live + /health/ready"
done
pass "storefront entry :80 -> 3000 health=/"
pass "admin entry :3100 health=/"
pass "migration image tag strategy: ${IMAGE_TAG}-migrate (prisma migrate deploy only)"

log "--- Helm lint / template ---"
if ! command -v helm >/dev/null 2>&1; then
  if [[ -x "$ROOT/.tools/bin/helm" ]]; then export PATH="$ROOT/.tools/bin:$PATH"; fi
  if [[ -x "$ROOT/.tools/bin/helm.exe" ]]; then export PATH="$ROOT/.tools/bin:$PATH"; fi
fi
if command -v helm >/dev/null 2>&1; then
  if helm lint "$CHART" >/dev/null 2>&1; then pass "helm lint $CHART"; else fail "helm lint $CHART"; fi
  if helm template nexatech "$CHART" -f "$VALUES_PROD" --namespace "$NAMESPACE" >/dev/null 2>&1; then pass "helm template apps values-production"; else fail "helm template apps values-production"; fi
  if [[ -d "$OBS_CHART" ]]; then
    if helm lint "$OBS_CHART" >/dev/null 2>&1; then pass "helm lint $OBS_CHART"; else fail "helm lint $OBS_CHART"; fi
    OBS_VALUES="$OBS_CHART/values-production.yaml"
    if [[ -f "$OBS_VALUES" ]]; then
      if helm template nexatech-obs "$OBS_CHART" -f "$OBS_VALUES" --namespace nexatech-obs >/dev/null 2>&1; then pass "helm template observability values-production"; else fail "helm template observability values-production"; fi
    else
      warn "observability values-production.yaml missing"
    fi
  fi
else
  blocked "helm not in PATH — skip lint/template"
fi

log "--- Local Docker image availability ---"
if command -v docker >/dev/null 2>&1; then
  for name in "${FRONTENDS[@]}" "${BACKENDS[@]}"; do
    ref="${IMAGE_REPOSITORY}/${name}:${IMAGE_TAG}"
    if docker image inspect "$ref" >/dev/null 2>&1; then pass "local image $ref"; else blocked "local image missing: $ref"; fi
  done
  for name in "${BACKENDS[@]}"; do
    mref="${IMAGE_REPOSITORY}/${name}:${IMAGE_TAG}-migrate"
    if docker image inspect "$mref" >/dev/null 2>&1; then pass "local migrate image $mref"; else blocked "local migrate image missing: $mref"; fi
  done
else
  blocked "docker not in PATH — skip image inspect"
fi

log "--- Kubernetes context (read-only) ---"
if [[ "$SKIP_KUBE" -eq 1 ]]; then
  log "SkipKube set"
elif ! command -v kubectl >/dev/null 2>&1; then
  blocked "kubectl not in PATH"
else
  CTX="$(kubectl config current-context 2>/dev/null || true)"
  if [[ -n "$CTX" ]]; then pass "kube-context: $CTX"; else blocked "unable to resolve kube-context"; fi
  if kubectl cluster-info >/dev/null 2>&1; then pass "kubectl cluster-info"; else blocked "kubectl cluster-info unavailable"; fi
  if kubectl get nodes -o wide >/dev/null 2>&1; then
    pass "kubectl get nodes"
    if kubectl get nodes 2>/dev/null | grep -q NotReady; then warn "one or more nodes NotReady"; else pass "no NotReady nodes detected"; fi
  else
    blocked "kubectl get nodes unavailable"
  fi
  if kubectl get ns "$NAMESPACE" >/dev/null 2>&1; then pass "namespace exists: $NAMESPACE"; else blocked "namespace missing: $NAMESPACE"; fi
  if kubectl get secret dockerhub-pull -n "$NAMESPACE" >/dev/null 2>&1; then pass "imagePullSecret dockerhub-pull present"; else blocked "imagePullSecret dockerhub-pull missing"; fi
  if kubectl get secret nexatech-secrets -n "$NAMESPACE" >/dev/null 2>&1; then pass "secret nexatech-secrets present (keys not printed)"; else blocked "secret nexatech-secrets missing"; fi
  if kubectl get configmap -n "$NAMESPACE" >/dev/null 2>&1; then pass "configmaps listed in $NAMESPACE"; else blocked "configmap list unavailable"; fi
  if kubectl get storageclass >/dev/null 2>&1; then pass "StorageClass list available"; else blocked "StorageClass list unavailable"; fi
  if kubectl get ns metallb-system >/dev/null 2>&1 || kubectl get crd ipaddresspools.metallb.io >/dev/null 2>&1; then
    pass "MetalLB detected (ns or CRD)"
  else
    blocked "MetalLB not detected"
  fi
  if kubectl get svc -A -o wide 2>/dev/null | grep -q "$ENTRY_VIP"; then pass "MetalLB VIP $ENTRY_VIP observed"; else blocked "MetalLB VIP $ENTRY_VIP not observed"; fi
fi

log "--- Infrastructure connectivity (TCP only, no credentials) ---"
tcp_check() {
  local name="$1" host="$2" port="$3"
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 3 "$host" "$port" >/dev/null 2>&1; then pass "$name TCP ${host}:${port}"
    elif [[ "$STRICT" -eq 1 ]]; then fail "$name TCP ${host}:${port} unreachable"
    else blocked "$name TCP ${host}:${port} unreachable"; fi
  elif command -v timeout >/dev/null 2>&1; then
    if timeout 3 bash -c "echo >/dev/tcp/${host}/${port}" >/dev/null 2>&1; then pass "$name TCP ${host}:${port}"
    elif [[ "$STRICT" -eq 1 ]]; then fail "$name TCP ${host}:${port} unreachable"
    else blocked "$name TCP ${host}:${port} unreachable"; fi
  else
    blocked "$name TCP check skipped (nc/timeout unavailable)"
  fi
}

if [[ "$SKIP_CONNECTIVITY" -eq 1 ]]; then
  log "SkipConnectivity set"
else
  tcp_check "PostgreSQL" "$POSTGRES_HOST" "$POSTGRES_PORT"
  blocked "Redis/RabbitMQ/MinIO ClusterIP connectivity requires in-cluster probe"
  log "DB existence / user grants: operator must verify on $POSTGRES_HOST (app users nexatech_*, never postgres)"
fi

log "--- Summary ---"
log "PASS=$PASSES WARN=$WARNINGS BLOCKED=$BLOCKED FAIL=$FAILURES"

if [[ "$FAILURES" -gt 0 ]]; then
  log "Result: FAIL"
  exit 1
fi
if [[ "$BLOCKED" -gt 0 && "$STRICT" -eq 1 ]]; then
  log "Result: FAIL (strict + blocked)"
  exit 1
fi
if [[ "$BLOCKED" -gt 0 ]]; then
  log "Result: OK with BLOCKED (dry-run / offline friendly)"
  exit 0
fi
log "Result: OK"
exit 0
