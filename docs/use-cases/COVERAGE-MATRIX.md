# Use-case coverage matrix

Status legend: `Done` | `Partial` | `Pending` | `Blocked`

| Domain                             | UC docs | Unit                       | Integration | E2E                                                | Impl                  |
| ---------------------------------- | ------- | -------------------------- | ----------- | -------------------------------------------------- | --------------------- |
| Identity                           | Done    | Done                       | Guarded     | Smoke + auth specs (needs `E2E_DEV_SEED_PASSWORD`) | Done                  |
| Customer / address                 | Done    | Done                       | Guarded     | Partial (auth-gated)                               | Done                  |
| Catalog / media                    | Done    | Done                       | Guarded     | Smoke + catalog-cart                               | Done                  |
| Inventory                          | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Cart / wishlist / compare / recent | Done    | Done (fail-fast)           | Guarded     | Smoke + catalog-cart                               | Done                  |
| Checkout / order                   | Done    | Done (P0 sync)             | Guarded     | Partial                                            | Done                  |
| Payment                            | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Standard shipping sync             | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Store Pickup sync                  | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Review                             | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Warranty / returns                 | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Support                            | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Notifications / Mailpit            | Done    | Done (degraded SMTP)       | Guarded     | Mailpit healthy                                    | Done                  |
| Reporting                          | Done    | Done                       | Guarded     | Partial                                            | Done                  |
| Admin RBAC                         | Done    | Done                       | —           | Smoke + auth-gated                                 | Done                  |
| BFF / Gateway                      | Done    | Done (bff-path)            | —           | Kong healthy                                       | Done                  |
| OpenAPI / Swagger                  | Done    | validate/diff PASS         | —           | Portal `/health`                                   | Done                  |
| Security Guide                     | Done    | `security-guide:test` PASS | —           | Portal `/health`                                   | Done                  |
| K8s / Kong packaging               | Done    | helm lint + kubeconform    | —           | —                                                  | Done (apply = DevOps) |

See `docs/use-cases/*.md` for per-UC fields (actors, events, APIs, tests).
