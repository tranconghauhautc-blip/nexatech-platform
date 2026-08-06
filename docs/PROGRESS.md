# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** Isolated E2E lab + K8s handoff package
- **Cập nhật lần cuối:** 2026-08-06
- **Branch:** `fix/media-upload-profile-minimal-reset`
- **Verdict:** **LAB_RUNNING_AND_K8S_HANDOFF_READY**

### Lab + handoff (2026-08-06)

- [x] Isolated E2E lab `nexatech-e2e` running (infra + 14 backends + fronts + Kong + portals)
- [x] Kong 3.9 declarative fix: nest routes under services (`infra/kong/kong.yml` + `kong.production.yml`)
- [x] E2E migrate + seed (RBAC, customers, catalog 100, inventory, pickup)
- [x] Focused smoke: `pnpm lab:smoke` + Kong login/cart/forgot-password/Mailpit
- [x] Handoff: `docs/deployment/K8S-DEPLOYMENT-CHECKLIST.md`, `INFRASTRUCTURE-INPUTS.md`, `deploy/images-manifest.txt`
- [x] `pnpm helm:lint` + helm template + kubeconform (65 nexatech / 6 kong)
- [x] Regression: `tests/kong/kong-declarative-nesting.test.cjs`, `tests/helm/handoff-render.test.cjs`

### Final pass closure (2026-08-05)

- [x] Windows host production builds: root cause was inherited `NODE_ENV=development` from `.env.e2e*`; fixed via `project.json` `cross-env NODE_ENV=production next build` + clean `.next` + import/guards
- [x] DEF-019 CLOSED — order outbox email + BFF `x-user-email`; e2e `e2e/api/def-019-order-notification.spec.ts`
- [x] Exact commands: `pnpm exec nx run storefront-web:build --configuration=production` and admin equivalent — **PASSED**

## Baseline

- Pre-follow-up HEAD: `383fefb`
- Docker E2E lab: **RUNNING**
- Helm lint (nexatech + kong via Docker image): **PASSED**
- kubeconform (65 nexatech + 6 kong resources): **PASSED**
- Secret leak scan: **PASSED**
- OpenAPI validate/diff: **PASSED** (prior pass)
- Unit tests (all 14 backends + shared libs sampled): **PASSED** (prior pass)
- Playwright smoke/responsive/catalog-cart: **PASSED** (prior pass)
- kubectl/helm on host: optional (validation used Docker Helm + kubeconform)

## Đã hoàn thành trong pass này

- [x] Cart fail-fast Redis/catalog/inventory (no silent InMemory outside test) + regression specs
- [x] Email DegradedEmailSender in production without SMTP (`NOTIFICATION_EMAIL_DEGRADED`)
- [x] Mailpit in `docker-compose.dev.yml` + notification SMTP wiring
- [x] support/warranty `MEDIA_SERVICE_URL` in compose (cold-start crash fix)
- [x] Kong Helm recursive checksum fix; portal ports 8090/3200; security-guide route
- [x] Helm apps: swagger-portal + security-guide-portal + internal service URLs
- [x] DB create-databases role-before-DB fix; migrate-all uses Helm Jobs (not CronJobs)
- [x] seed-required.cjs + hardened seed-required.ps1
- [x] E2E packaging: `.env.e2e.example`, setup/seed scripts, Mailpit
- [x] package.json aliases: `helm:lint`, `docker:build:all`, `e2e:*`
- [x] A11y: storefront contrast tokens (`--nt-link`, `--nt-text-faint`), search/account labels; swagger-ui-dist excluded from axe; address form e2e expands “Thêm địa chỉ”

## DevOps prerequisites (operator-owned — not development blockers)

| Variable / artifact                 | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `KUBECONFIG` / control-plane access | Apply charts                          |
| `KONG_NODE_NAME` / node labels      | Dedicated Kong node                   |
| `POSTGRES_HOST` + admin credentials | External DB create/migrate            |
| `CONTAINER_REGISTRY_URL` + token    | Image push                            |
| `METALLB_ADDRESS_POOL` / VIP        | Kong LoadBalancer                     |
| `REQUIRED_SEED_PASSWORD`            | Required account seed                 |
| Gmail `SMTP_*`                      | Production email (Mailpit until then) |

## Giữ nguyên RC fixes trước đó

P0 shipping/pickup sync, payment Staff sync headers, integration DB guards, profile UI, BFF keys — không discard.
