# SLI / SLO Draft — NexaTech (M20)

> **Draft for operator confirmation.** Not a contractual SLA until signed off.

## SLIs

| SLI                           | Measurement                                 | Source                 |
| ----------------------------- | ------------------------------------------- | ---------------------- |
| HTTP availability             | Successful non-5xx / total at Kong or entry | Prometheus / synthetic |
| p95 latency                   | Request duration p95 by route class         | Prometheus / k6        |
| 5xx rate                      | 5xx / total                                 | Prometheus             |
| Order create success          | Successful create / attempts (auth)         | App metrics / logs     |
| Payment callback success      | Valid callbacks processed / received        | payment-service        |
| Queue lag                     | RabbitMQ ready messages / age               | RabbitMQ exporter      |
| Notification delivery success | Sent / attempted                            | notification-service   |
| Backup success                | Successful backup jobs / scheduled          | Backup monitor         |
| Migration success             | Migrate Jobs Completed / attempts           | Kubernetes             |
| Pod restart rate              | Restarts / hour per Deployment              | kube-state-metrics     |

## SLO targets (initial lab → staging proposals)

| Area                               | Target                                    | Error budget notes          |
| ---------------------------------- | ----------------------------------------- | --------------------------- |
| Availability (storefront+API edge) | 99.5% monthly (lab), aim 99.9% prod later | Exclude planned maintenance |
| p95 latency browse/catalog         | < 800ms prod goal; lab gate 1500ms        | See PERFORMANCE-TESTING     |
| p95 checkout path                  | < 2000ms                                  | Depends on inventory+PG     |
| 5xx rate                           | < 1% rolling 5m                           | Page on sustained breach    |
| Backup success                     | 100% daily PG dump                        | Any miss = Sev2             |
| RPO PostgreSQL                     | ≤ 24h (daily backup) draft                | Confirm PITR later          |
| RTO core storefront                | ≤ 4h draft                                | Confirm with ops            |
| Migrate Job success                | 100% per release                          | Block rollout on fail       |

## Error budget policy (draft)

1. Burn > 2% monthly budget in 1h → page on-call.
2. Feature freezes when budget < 20% remaining in month.
3. Chaos experiments only when budget healthy.

## Related

- `docs/DISASTER-RECOVERY.md`
- `docs/PERFORMANCE-TESTING.md`
- `deploy/observability/alerts/nexatech-alerts.yaml`
