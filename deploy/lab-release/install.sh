#!/usr/bin/env bash
# NexaTech one-shot install — run from deploy/lab-release on the K8s server.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NS="${NAMESPACE:-nexatech}"
RELEASE="${RELEASE:-nexatech}"
SECRET_ENV="${SECRET_ENV:-$HERE/secret.env}"
CHART="$(ls "$HERE"/charts/nexatech-*.tgz | head -n1)"
VALUES="$HERE/values-ghcr.yaml"
NODEPORT_VALUES="$HERE/values-nodeport.yaml"

test -f "$CHART" || { echo "Missing chart tgz under charts/"; exit 1; }
test -f "$VALUES" || { echo "Missing values-ghcr.yaml"; exit 1; }
test -f "$SECRET_ENV" || {
  echo "Missing $SECRET_ENV"
  echo "Run: cp secret.env.example secret.env && edit passwords"
  exit 1
}

command -v kubectl >/dev/null || { echo "kubectl not found"; exit 1; }
command -v helm >/dev/null || { echo "helm not found — install Helm 3 first"; exit 1; }

kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"

EXTRA=()
if [[ "${USE_NODEPORT:-0}" == "1" ]]; then
  echo "==> USE_NODEPORT=1 — entry Service as NodePort"
  EXTRA+=(-f "$NODEPORT_VALUES")
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  USERNAME="${GHCR_USERNAME:-tranconghauhautc-blip}"
  echo "==> creating imagePullSecret ghcr-pull (private packages)"
  kubectl -n "$NS" delete secret ghcr-pull --ignore-not-found
  kubectl -n "$NS" create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io \
    --docker-username="$USERNAME" \
    --docker-password="$GHCR_TOKEN"
  cat > "$HERE/values-pullsecret.generated.yaml" <<EOF
global:
  imagePullSecrets:
    - name: ghcr-pull
EOF
  EXTRA+=(-f "$HERE/values-pullsecret.generated.yaml")
else
  echo "==> public GHCR — no imagePullSecret"
fi

echo "==> secret nexatech-secrets"
kubectl -n "$NS" delete secret nexatech-secrets --ignore-not-found
kubectl -n "$NS" create secret generic nexatech-secrets --from-env-file="$SECRET_ENV"

echo "==> helm upgrade --install $RELEASE"
helm upgrade --install "$RELEASE" "$CHART" \
  -n "$NS" \
  -f "$VALUES" \
  "${EXTRA[@]}" \
  --wait --timeout 20m

echo "OK"
kubectl -n "$NS" get pods
kubectl -n "$NS" get svc
