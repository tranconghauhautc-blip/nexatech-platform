# Deployment Order — NexaTech (M19)

Canonical order for first install and major upgrades. Do not skip migrate Jobs. Do not use `latest`.

## Ordered steps

1. **Namespace** — create `nexatech` (and `nexatech-obs` if observability).
2. **StorageClass** — verify default / required class for platform PVCs.
3. **MetalLB** — install/configure; reserve VIP **`192.168.4.204`**.
4. **imagePullSecret** — `dockerhub-pull` in app namespace.
5. **Application Secrets** — `nexatech-secrets` from operator-managed values (never commit).
6. **ConfigMaps** — chart-managed app config (non-secret).
7. **Redis / RabbitMQ / MinIO** — platform Deployments (ClusterIP only).
8. **Bucket initialization** — MinIO bucket-init Job.
9. **Prisma migration Jobs** — `prisma migrate deploy` only; failure blocks rollout (Helm pre-hooks).
10. **Production-safe seed** — optional; requires `CONFIRM_PRODUCTION=YES` + strong admin password; **never** unattended into prod.
11. **Backend Deployments** — 14 Nest services.
12. **Frontend Deployments** — storefront-web, admin-web.
13. **MetalLB entry** — nginx entry Service LoadBalancer → VIP `.204`.
14. **Observability** — optional chart `nexatech-observability` (ClusterIP only).
15. **Kong config** — declarative on VM **`192.168.4.209`** upstream to VIP only (**OPERATOR**).
16. **Smoke tests** — `scripts/smoke-release.*` + `validate-production.*`.
17. **Citrix / Imperva mapping** — external edge (**BLOCKED_EXTERNAL** for agents).

## Migration sequencing notes

- Each service owns its database; migrate Jobs are independent per DB.
- Preferred order when introducing cross-service contracts: identity → customer → catalog/media → inventory → cart → order → payment/shipping → review/warranty/support → notification → reporting.
- Helm runs migrate hooks before new pods; `backoffLimit: 1`.
- On failure: inspect logs → fix Secret/network/grants → delete failed Job → re-run upgrade. See `docs/MIGRATIONS.md`.

## Seed sequencing notes

1. Ensure catalog migrate succeeded.
2. Dry-run: `node scripts/seed-catalog-production.cjs --dry-run`.
3. Execute only with operator confirmation env guards.
4. Idempotent ~100 ACTIVE products; no real PII; no weak passwords; no real provider credentials.
5. Bootstrap admin via identity secure path / operator runbook — not via seed of plaintext weak password.

## Kong / MetalLB static expectations

| Item              | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Kong VM           | `192.168.4.209`                                           |
| MetalLB VIP       | `192.168.4.204`                                           |
| Storefront        | `/` (strip_path false)                                    |
| Admin             | `/admin` (strip_path true)                                |
| API               | `/api/v1`, `/api/v2`                                      |
| Timeouts          | connect 5s / read-write 60s (production yml)              |
| Retries           | 3                                                         |
| Request id        | correlation-id / `x-request-id`                           |
| Internal exposure | No direct public Service for Redis/RabbitMQ/MinIO/Grafana |

Agents must **not** mutate Kong VM or live cluster in unattended mode.

## Related

- `docs/DEPLOY-RUNBOOK-PRODUCTION.md`
- `docs/RELEASE-CHECKLIST.md`
- `docs/IMAGE-MATRIX.md`
- `scripts/deploy-preflight.ps1` / `.sh`
