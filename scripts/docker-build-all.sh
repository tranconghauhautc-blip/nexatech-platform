#!/usr/bin/env bash
# NexaTech Docker image catalog — build/push all or one.
# Usage:
#   ./scripts/docker-build-all.sh
#   ./scripts/docker-build-all.sh identity-service
#   PUSH=1 ./scripts/docker-build-all.sh   # requires prior docker login
# Env: DOCKERHUB_USER, IMAGE_TAG, IMAGE_REPOSITORY, USE_GIT_SHA=1, SKIP_MIGRATE=1
# Does NOT run docker login.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO="${IMAGE_REPOSITORY:-nexatech}"
TAG="${IMAGE_TAG:-}"
if [[ "${USE_GIT_SHA:-0}" == "1" ]]; then
  TAG="$(git rev-parse --short HEAD)"
fi
TAG="${TAG:-0.17.0}"
USER_NS="${DOCKERHUB_USER:-}"

BACKENDS=(
  identity-service customer-service catalog-service media-service
  inventory-service cart-service order-service payment-service
  shipping-service review-service warranty-service support-service
  notification-service reporting-service
)
FRONTENDS=(storefront-web admin-web)
ALL=("${BACKENDS[@]}" "${FRONTENDS[@]}")

image_ref() {
  local name="$1" tag="$2"
  if [[ -n "$USER_NS" ]]; then
    echo "${USER_NS}/${REPO}/${name}:${tag}"
  else
    echo "${REPO}/${name}:${tag}"
  fi
}

is_backend() {
  local n="$1"
  for b in "${BACKENDS[@]}"; do [[ "$b" == "$n" ]] && return 0; done
  return 1
}

TARGETS=()
if [[ $# -ge 1 && -n "${1:-}" ]]; then
  TARGETS=("$1")
else
  TARGETS=("${ALL[@]}")
fi

for name in "${TARGETS[@]}"; do
  found=0
  for a in "${ALL[@]}"; do [[ "$a" == "$name" ]] && found=1; done
  [[ "$found" -eq 1 ]] || { echo "Unknown image: $name" >&2; exit 1; }

  ref="$(image_ref "$name" "$TAG")"
  echo "==> Building $ref"
  docker build -f "apps/${name}/Dockerfile" -t "$ref" .

  if [[ "${SKIP_MIGRATE:-0}" != "1" ]] && is_backend "$name"; then
    mref="$(image_ref "$name" "${TAG}-migrate")"
    echo "==> Building migrate $mref"
    docker build -f deploy/docker/prisma-migrate.Dockerfile \
      --build-arg "SERVICE_NAME=${name}" \
      -t "$mref" .
  fi

  if [[ "${PUSH:-0}" == "1" ]]; then
    echo "==> Pushing $ref"
    docker push "$ref"
    if [[ "${SKIP_MIGRATE:-0}" != "1" ]] && is_backend "$name"; then
      mref="$(image_ref "$name" "${TAG}-migrate")"
      docker push "$mref"
    fi
  fi
done

echo "OK: built ${#TARGETS[@]} app image(s) tag=${TAG}"
