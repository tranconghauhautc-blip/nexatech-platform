# NexaTech Deployment

## Môi trường

| Env           | Mục đích        | Orchestration             |
| ------------- | --------------- | ------------------------- |
| `local`       | Dev máy cá nhân | Docker Compose + Nx serve |
| `integration` | Test tích hợp   | Compose full stack        |
| `production`  | Kubernetes      | Helm + Kong               |

## Nguyên tắc

- Mỗi app có Dockerfile riêng (Linux multi-stage)
- Không hard-code IP/domain/secret
- Env var + schema validation (`libs/shared/config`)
- Image tag semver/git-sha — **không** dùng `latest`
- App DB user riêng per service
- Health/live/ready bắt buộc trước khi nhận traffic

## Local dependencies (Compose)

Services hạ tầng tối thiểu:

- PostgreSQL 16 (nhiều database)
- Redis 7
- RabbitMQ 3.13+ (management plugin)
- MinIO
- Mailhog / Mailpit (dev email)
- Kong (local qua `docker-compose.apps.yml`)

## Dockerfile pattern

```text
deps → build (Nx) → production runtime (node slim)
```

Mỗi service expose:

- HTTP port riêng (map qua env `PORT`)
- `/health`, `/health/live`, `/health/ready`

## Kong

- Declarative config: `infra/kong/kong.yml`
- Local: Compose service `kong` trong `docker-compose.apps.yml` (proxy `:8000`, admin `:8001`)
- Routes theo prefix `/api/v1` và `/api/v2` → từng microservice (strip_path=false)
- Plugins: cors, correlation-id (`x-request-id`)
- JWT plugin / rate-limit chi tiết: milestone sau khi auth header giả lập được thay

## App images (M16)

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker network create nexatech-dev 2>$null
docker compose -f infra/docker/docker-compose.apps.yml up -d --build
```

Mỗi Nest app: `apps/<service>/Dockerfile` (tag `nexatech/<service>:0.16.0`). Frontend: Dockerfile M15, tag `0.16.0` trong compose apps.

## Seed catalog

```bash
cd apps/catalog-service && npx prisma migrate deploy && npx prisma generate
$env:CATALOG_DATABASE_URL='postgresql://nexatech_catalog:changeme@localhost:5432/nexatech_catalog'
pnpm seed:catalog
```

## Kubernetes / Helm (M19)

Chart structure dự kiến:

```text
deploy/helm/nexatech/
  Chart.yaml
  values.yaml
  values-prod.yaml
  templates/
    apps/*
    kong/*
    configmaps/*
    secrets-ref/*
    ingress-or-kong-routes/*
```

Mỗi microservice: Deployment + Service + ConfigMap + Secret ref + ServiceMonitor (optional).

## Secrets cần cung cấp sau (không commit)

- `DATABASE_URL_*`
- `REDIS_URL`
- `RABBITMQ_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `SECRET`
- `SMTP_*` hoặc Gmail App Password
- `VNPAY_*`
- `SHIPPING_PROVIDER_*`
- `MINIO_ACCESS_KEY` / `SECRET_KEY`
- Docker Hub credentials (M22)

## Image registry plan (M22)

```text
docker.io/<DOCKERHUB_USER>/nexatech-<app>:<version>
```

Build tất cả app images; push chỉ khi user cung cấp username/token.
