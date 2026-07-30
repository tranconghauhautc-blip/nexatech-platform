# Image Matrix — NexaTech (M19)

Machine-readable source: [`docs/image-matrix.json`](./image-matrix.json).

## Version strategy

| Rule            | Detail                                                               |
| --------------- | -------------------------------------------------------------------- |
| Default app tag | `0.17.0` (align Helm `appVersion` / `global.imageTag`)               |
| Migrate tag     | `{IMAGE_TAG}-migrate` (e.g. `0.17.0-migrate`)                        |
| Git SHA option  | `scripts/docker-build-all.* -UseGitSha` / `--use-git-sha`            |
| Forbidden       | **`latest`** (ADR-014 / ADR-036)                                     |
| Architecture    | `linux/amd64` (Kubernetes lab nodes)                                 |
| Registry local  | `nexatech/<name>:<tag>`                                              |
| Registry Hub    | `{DOCKERHUB_USER}/nexatech/<name>:<tag>`                             |
| Helm production | `{global.imageRegistry}/{global.imageRepository}/{image.name}:{tag}` |

Align `IMAGE_REPOSITORY` / Helm `global.imageRepository` intentionally before push.

## Frontend

| Image            | Dockerfile                       | Port             | Health | Tag      |
| ---------------- | -------------------------------- | ---------------- | ------ | -------- |
| `storefront-web` | `apps/storefront-web/Dockerfile` | 3000 (entry :80) | `/`    | `0.17.0` |
| `admin-web`      | `apps/admin-web/Dockerfile`      | 3100             | `/`    | `0.17.0` |

Build context: repository root `.`

## Backend

| Image                  | Port | Health         | Ready           | Tag      |
| ---------------------- | ---- | -------------- | --------------- | -------- |
| `identity-service`     | 3001 | `/health/live` | `/health/ready` | `0.17.0` |
| `customer-service`     | 3002 | `/health/live` | `/health/ready` | `0.17.0` |
| `catalog-service`      | 3003 | `/health/live` | `/health/ready` | `0.17.0` |
| `media-service`        | 3004 | `/health/live` | `/health/ready` | `0.17.0` |
| `inventory-service`    | 3005 | `/health/live` | `/health/ready` | `0.17.0` |
| `cart-service`         | 3006 | `/health/live` | `/health/ready` | `0.17.0` |
| `order-service`        | 3007 | `/health/live` | `/health/ready` | `0.17.0` |
| `payment-service`      | 3008 | `/health/live` | `/health/ready` | `0.17.0` |
| `shipping-service`     | 3009 | `/health/live` | `/health/ready` | `0.17.0` |
| `review-service`       | 3010 | `/health/live` | `/health/ready` | `0.17.0` |
| `warranty-service`     | 3011 | `/health/live` | `/health/ready` | `0.17.0` |
| `support-service`      | 3012 | `/health/live` | `/health/ready` | `0.17.0` |
| `notification-service` | 3013 | `/health/live` | `/health/ready` | `0.17.0` |
| `reporting-service`    | 3014 | `/health/live` | `/health/ready` | `0.17.0` |

Dockerfile per service: `apps/<name>/Dockerfile`. Build context: `.`

## Migration images

| Image              | Dockerfile                                                 | Command                      | Tag              |
| ------------------ | ---------------------------------------------------------- | ---------------------------- | ---------------- |
| each backend above | `deploy/docker/prisma-migrate.Dockerfile` (`SERVICE_NAME`) | `prisma migrate deploy` only | `0.17.0-migrate` |

**Forbidden in migrate containers:** `migrate reset`, `db push`, shell that drops schema.

## Platform (third-party pins)

| Component   | Image pin                                                   |
| ----------- | ----------------------------------------------------------- |
| Redis       | `redis:7.4.2-alpine`                                        |
| RabbitMQ    | `rabbitmq:3.13.7-management-alpine` (ClusterIP only)        |
| MinIO       | `minio/minio:RELEASE.2025-01-20T14-49-07Z` (ClusterIP only) |
| Entry nginx | `nginxinc/nginx-unprivileged:1.27.3-alpine`                 |

## Build commands

```powershell
.\scripts\docker-build-all.ps1
.\scripts\docker-build-all.ps1 -Image catalog-service
# Push only after docker login (operator):
.\scripts\docker-build-all.ps1 -Push
```

```bash
./scripts/docker-build-all.sh
IMAGE_TAG=0.17.0 ./scripts/docker-build-all.sh
```

## SHA / digest strategy

1. Build with semver tag matching Helm `global.imageTag`.
2. Optionally also tag git short SHA for audit.
3. Record digest (`docker inspect --format='{{index .RepoDigests 0}}'`) in release notes after push (operator).
4. Prefer digest pinning in locked environments after first successful prod promote.

## Related

- `docs/RELEASE-CHECKLIST.md`
- `docs/DEPLOYMENT-ORDER.md`
- `scripts/deploy-preflight.ps1` / `.sh`
- `scripts/docker-build-all.ps1` / `.sh`
