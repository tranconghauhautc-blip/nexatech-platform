# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** ONE-SHOT final engineering handoff — FINAL PASS complete
- **Cập nhật lần cuối:** 2026-08-05
- **Branch:** `fix/media-upload-profile-minimal-reset` @ `b593564` (+ dirty working tree)
- **Owner gate:** Không commit / không push
- **Verdict:** **READY_FOR_DEVOPS**

### Final pass closure (2026-08-05)

- [x] Windows host production builds: root cause was inherited `NODE_ENV=development` from `.env.e2e*`; fixed via `project.json` `cross-env NODE_ENV=production next build` + clean `.next` + import/guards
- [x] DEF-019 CLOSED — order outbox email + BFF `x-user-email`; e2e `e2e/api/def-019-order-notification.spec.ts`
- [x] Exact commands: `pnpm exec nx run storefront-web:build --configuration=production` and admin equivalent — **PASSED**
- [x] Isolated E2E lab shut down (`docker-compose.e2e.yml` + apps overlay)

## Baseline

- HEAD: `b593564`
- Docker cold start (one `up -d --build`, volumes preserved): **PASSED** — all apps + Mailpit + Kong healthy
- Helm lint (nexatech + kong via Docker image): **PASSED**
- kubeconform (65 nexatech + 6 kong resources): **PASSED**
- OpenAPI validate/diff: **PASSED**
- Unit tests (all 14 backends + shared libs sampled): **PASSED**
- Playwright smoke/responsive/catalog-cart: **PASSED** (11/11 then 7/7 post cold-start)
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
