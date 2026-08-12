# VulnCart Progress

## Trạng thái hiện tại

- **Milestone:** VulnCart lean K8s API lab (monolith)
- **Cập nhật:** 2026-08-12
- **Brand:** VulnCart
- **Verdict:** READY_FOR_IMAGE_BUILD_AND_HELM

### Done

- [x] `apps/backend-api` NestJS monolith + Prisma (`vulncart` schema)
- [x] Intentional vulns always-on (no SECURITY_LAB toggle)
- [x] Swagger OpenAPI 3 at `/api/docs` with Bearer JWT + tags
- [x] Lean UIs: storefront / admin / security-guide (`apps/vulncart-*`)
- [x] Helm chart `deploy/helm/vulncart` (Postgres PVC local-path, Ingress nginx, migrate Job)
- [x] `install.sh` + `secret.env.example`
- [x] Docs: `docs/VULNCART.md`
- [x] `nx build backend-api` OK

### Operator next steps

1. Build/push images (`scripts/vulncart-build-images.sh`)
2. `cp secret.env.example secret.env` && fill secrets
3. `./install.sh`

Legacy NexaTech microservices / Kong charts remain in repo but are **not** the VulnCart deploy path.
