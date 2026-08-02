# K8s Migration Readiness (draft)

> Prepared **2026-08-02** during functional re-baseline. Not a go-live approval.

## Ready locally

| Area                                  | Status                                  |
| ------------------------------------- | --------------------------------------- |
| 14 Nest services + health endpoints   | Healthy on Compose                      |
| Storefront / Admin                    | Healthy                                 |
| Kong declarative routes               | Present (`infra/kong/kong.yml`)         |
| OpenAPI 3.0.3 combined                | Present; regenerate after endpoint adds |
| Postgres per-service DBs              | Init SQL + Prisma migrations            |
| Redis / RabbitMQ / MinIO              | Compose healthy                         |
| Intentional vulns always-on (ADR-044) | Documented; Helm isolation separate     |

## Blockers / conversions before K8s

| Item | Detail |
| ---- | ------ |
| Hostnames | `localhost`, `minio:9000` browser rewrite → cluster ingress / public MinIO URL |
| Secrets | No hard-coded prod credentials; need sealed secrets / ExternalSecrets |
| Image registry | Docker Hub username/token still external |
| Image tags | Use semver (already `0.17.0`); never `latest` |
| Persistent volumes | Postgres, MinIO, RabbitMQ need PVCs |
| VNPay / Google OAuth / SMTP | Still external credentials |
| Audit projection | Operational audit incomplete until `AUDIT_RECORDED` wired broadly |
| Functional acceptance | **Local Compose acceptance complete 2026-08-02** — still needs owner commit + registry credentials before cluster cutover |

## Local acceptance snapshot

See `docs/FUNCTIONAL-ACCEPTANCE-REPORT.md` — payments/reviews authenticated PASS; OpenAPI 3.0.3; e2e 23/23; media-e2e PASS; security always-on EXPLOITABLE.

## Service ports (local reference)

3000 storefront · 3100 admin · 3001–3014 Nest · 8000 Kong · 8090 swagger · 3200 security-guide · 5432/6379/5672/9000 infra

## Recommendation

Complete functional acceptance on Compose first (this re-baseline), then design Helm values from `deploy/` using this inventory — do not treat prior milestone docs as complete without re-verify.
