#!/usr/bin/env bash
# VulnCart one-command install for a 3-node Kubernetes lab cluster.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-vulncart}"
RELEASE="${RELEASE:-vulncart}"
CHART_DIR="${CHART_DIR:-$ROOT_DIR/deploy/helm/vulncart}"
SECRET_ENV="${SECRET_ENV:-$ROOT_DIR/secret.env}"
VALUES_FILE="${VALUES_FILE:-}"
TIMEOUT="${TIMEOUT:-10m}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Missing required command: $1"
    exit 1
  fi
}

info "Checking kubectl / helm"
need_cmd kubectl
need_cmd helm
kubectl cluster-info >/dev/null

info "Checking ingress class nginx"
if ! kubectl get ingressclass nginx >/dev/null 2>&1; then
  red "IngressClass 'nginx' not found. Install ingress-nginx first."
  exit 1
fi

info "Checking StorageClass local-path"
if ! kubectl get storageclass local-path >/dev/null 2>&1; then
  red "StorageClass 'local-path' not found. Install local-path-provisioner first."
  exit 1
fi

if [[ ! -f "$SECRET_ENV" ]]; then
  red "Missing $SECRET_ENV"
  echo "Copy secret.env.example -> secret.env and fill values."
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$SECRET_ENV"
set +a

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required in secret.env}"
: "${JWT_SECRET:?JWT_SECRET required in secret.env}"
: "${ADMIN_USERNAME:?ADMIN_USERNAME required in secret.env}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD required in secret.env}"

# Optional: DATABASE_URL — if empty, build from postgres service DNS
DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  # URL-encode password (python3 or node)
  if command -v python3 >/dev/null 2>&1; then
    ENC_PW="$(python3 -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["POSTGRES_PASSWORD"], safe=""))')"
  else
    ENC_PW="$(node -e 'console.log(encodeURIComponent(process.env.POSTGRES_PASSWORD))')"
  fi
  DATABASE_URL="postgresql://vulncart_app:${ENC_PW}@${RELEASE}-postgres:5432/vulncart"
fi
export DATABASE_URL
export POSTGRES_PASSWORD

info "Creating namespace $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

HELM_ARGS=(
  upgrade --install "$RELEASE" "$CHART_DIR"
  --namespace "$NAMESPACE"
  --set-string "secret.postgresPassword=${POSTGRES_PASSWORD}"
  --set-string "secret.jwtSecret=${JWT_SECRET}"
  --set-string "secret.adminUsername=${ADMIN_USERNAME}"
  --set-string "secret.adminPassword=${ADMIN_PASSWORD}"
  --wait
  --timeout "$TIMEOUT"
)

if [[ -n "$DATABASE_URL" ]]; then
  HELM_ARGS+=(--set-string "secret.databaseUrl=${DATABASE_URL}")
fi

if [[ -n "$VALUES_FILE" ]]; then
  HELM_ARGS+=(-f "$VALUES_FILE")
fi

# Optional image overrides from env
if [[ -n "${BACKEND_IMAGE:-}" ]]; then
  HELM_ARGS+=(--set-string "images.backendApi.repository=${BACKEND_IMAGE%:*}" --set-string "images.backendApi.tag=${BACKEND_IMAGE##*:}")
fi
if [[ -n "${MIGRATE_IMAGE:-}" ]]; then
  HELM_ARGS+=(--set-string "images.migrate.repository=${MIGRATE_IMAGE%:*}" --set-string "images.migrate.tag=${MIGRATE_IMAGE##*:}")
fi
if [[ -n "${STOREFRONT_IMAGE:-}" ]]; then
  HELM_ARGS+=(--set-string "images.storefront.repository=${STOREFRONT_IMAGE%:*}" --set-string "images.storefront.tag=${STOREFRONT_IMAGE##*:}")
fi
if [[ -n "${ADMIN_IMAGE:-}" ]]; then
  HELM_ARGS+=(--set-string "images.admin.repository=${ADMIN_IMAGE%:*}" --set-string "images.admin.tag=${ADMIN_IMAGE##*:}")
fi
if [[ -n "${GUIDE_IMAGE:-}" ]]; then
  HELM_ARGS+=(--set-string "images.securityGuide.repository=${GUIDE_IMAGE%:*}" --set-string "images.securityGuide.tag=${GUIDE_IMAGE##*:}")
fi

info "helm upgrade --install $RELEASE"
helm "${HELM_ARGS[@]}"

info "Waiting for rollouts"
kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-backend-api" --timeout=300s || true
kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-storefront-web" --timeout=180s || true
kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-admin-web" --timeout=180s || true
kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-security-guide" --timeout=180s || true

echo
green "=== VulnCart pods ==="
kubectl -n "$NAMESPACE" get pods -o wide

echo
green "=== Ingress ==="
kubectl -n "$NAMESPACE" get ingress -o wide

INGRESS_IP="$(kubectl -n "$NAMESPACE" get ingress "$RELEASE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
if [[ -z "$INGRESS_IP" ]]; then
  INGRESS_IP="$(kubectl -n "$NAMESPACE" get ingress "$RELEASE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
fi
if [[ -z "$INGRESS_IP" ]]; then
  INGRESS_IP="<ingress-nginx NodePort / hostIP>"
fi

echo
green "=== URLs ==="
echo "Storefront:      http://${INGRESS_IP}/"
echo "Admin:           http://${INGRESS_IP}/admin/"
echo "Security Guide:  http://${INGRESS_IP}/security-guide/"
echo "Swagger:         http://${INGRESS_IP}/api/docs"
echo "OpenAPI JSON:    http://${INGRESS_IP}/api/docs-json"
echo
green "VulnCart install complete."
