# NexaTech Deployment

## Môi trường

| Env | Mục đích | Orchestration |
|-----|----------|---------------|
| `local` | Dev máy cá nhân | Docker Compose + Nx serve |
| `integration` | Test tích hợp | Compose full stack |
| `production` | Kubernetes | Helm + Kong |

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
- Kong (optional local; có thể gọi thẳng service khi dev)

## Dockerfile pattern

```text
deps → build (Nx) → production runtime (node slim)
```

Mỗi service expose:

- HTTP port riêng (map qua env `PORT`)
- `/health`, `/health/live`, `/health/ready`

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

## Kong

- Declarative config (`kong.yml`) trong repo
- Routes theo prefix:
  - `/api/v1/auth` → identity
  - `/api/v1/customers` → customer
  - `/api/v1/products` → catalog
  - ... (map đầy đủ ở M18/M19)
- Plugins: cors, rate-limiting, jwt (khi sẵn sàng), request-id

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
