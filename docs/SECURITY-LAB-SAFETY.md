# Security Lab Safety — M21

## Required acknowledgements

| Control                | Rule                                      |
| ---------------------- | ----------------------------------------- |
| `SECURITY_LAB_ACK=YES` | Required for lab PoC runners              |
| Private targets only   | localhost / RFC1918 / lab allowlist       |
| Lab marker             | Prefer verifying `/health/lab` before PoC |
| No production hostname | Refuse public Internet by default         |

## Forbidden

- Enabling lab via header/cookie/query
- Pointing lab at production PostgreSQL/MinIO
- Real customer/order/payment data
- Public exposure of lab without ADC allowlist
- Logging tokens/secrets in PoC output
- Internet scanning / brute force outside lab

## Cleanup

Use disposable lab namespace and databases. Delete lab release when done (**OPERATOR**).
