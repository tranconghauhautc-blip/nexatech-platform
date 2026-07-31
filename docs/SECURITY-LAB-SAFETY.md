# Security Lab Safety — M21+

## Required acknowledgements

| Control                | Rule                                      |
| ---------------------- | ----------------------------------------- |
| `SECURITY_LAB_ACK=YES` | Required for lab PoC runners              |
| Private targets only   | localhost / RFC1918 / lab allowlist       |
| Lab marker             | Prefer verifying `/health/lab` before PoC |
| No production hostname | Refuse public Internet by default         |
| Supply-chain demos     | Fixture-only; never download malware      |

## Forbidden

- Enabling lab via header/cookie/query/body/runtime admin endpoint
- Pointing lab at production PostgreSQL/MinIO/Redis/RabbitMQ
- Real customer/order/payment data
- Public exposure of lab without ADC allowlist
- Logging tokens/secrets in PoC output
- Internet scanning / brute force outside lab
- Hard-coded default passwords in seed scripts

## DEV account seed safety

| Control                       | Rule                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV` ≠ `production`     | Required                                                                    |
| `NEXATECH_ALLOW_DEV_SEED=YES` | Required acknowledgement                                                    |
| `DEV_SEED_PASSWORD`           | Operator-defined; min 12; complexity; never committed                       |
| `DEV_SEED_RESET_PASSWORD=YES` | Required to reset existing seeded passwords                                 |
| Scope                         | Only 4 `@nexatech.local` Staff+ accounts; no Customer; no other-user delete |

## Cleanup

Use disposable lab namespace and databases. Delete lab release when done (**OPERATOR**).
