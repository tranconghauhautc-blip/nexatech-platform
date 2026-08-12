#!/usr/bin/env bash
# Build & (optionally) push VulnCart images.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${REGISTRY:-vulncart}"
TAG="${TAG:-1.0.0}"

build() {
  local name="$1" dockerfile="$2" context="${3:-$ROOT}"
  echo "==> Building $REGISTRY/$name:$TAG"
  docker build -f "$dockerfile" -t "$REGISTRY/$name:$TAG" "$context"
}

build backend-api "$ROOT/apps/backend-api/Dockerfile"
build backend-api-migrate "$ROOT/apps/backend-api/Dockerfile.migrate"
build storefront-web "$ROOT/apps/vulncart-storefront/Dockerfile"
build admin-web "$ROOT/apps/vulncart-admin/Dockerfile"
build security-guide-portal "$ROOT/apps/vulncart-guide/Dockerfile"

if [[ "${PUSH:-0}" == "1" ]]; then
  for n in backend-api backend-api-migrate storefront-web admin-web security-guide-portal; do
    docker push "$REGISTRY/$n:$TAG"
  done
fi

echo "Done. Example install image overrides:"
echo "  BACKEND_IMAGE=$REGISTRY/backend-api:$TAG"
echo "  MIGRATE_IMAGE=$REGISTRY/backend-api-migrate:$TAG"
echo "  STOREFRONT_IMAGE=$REGISTRY/storefront-web:$TAG"
echo "  ADMIN_IMAGE=$REGISTRY/admin-web:$TAG"
echo "  GUIDE_IMAGE=$REGISTRY/security-guide-portal:$TAG"
