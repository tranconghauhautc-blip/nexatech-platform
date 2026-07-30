# Performance Testing — NexaTech (M20)

## Scope

k6 scenarios under `tests/k6/` for lab / staging private targets. **Not** a license to load-test production or the public Internet.

## Target guard

Scripts refuse hosts outside:

- `localhost` / `127.0.0.1` / `::1`
- RFC1918
- MetalLB VIP `192.168.4.204` / Kong `192.168.4.209`

Operator override only: `K6_ALLOW_PUBLIC=YES` (discouraged).

Never log tokens, cookies, or secret headers.

## Scenarios

| Script                       | Intent                                               |
| ---------------------------- | ---------------------------------------------------- |
| `storefront-browse.js`       | Storefront home                                      |
| `catalog-listing.js`         | Product list                                         |
| `product-search.js`          | Search/filter                                        |
| `product-detail.js`          | PDP / list fallback                                  |
| `cart-mutation.js`           | Cart ready + optional guest create (`CART_MUTATE=1`) |
| `cart-validation.js`         | Cart live                                            |
| `checkout-mock.js`           | Order ready (mock-safe)                              |
| `order-create-mock.js`       | Order live (no create by default)                    |
| `payment-mock.js`            | Payment ready                                        |
| `admin-reporting-read.js`    | Reporting ready                                      |
| `notification-inbox-read.js` | Notification ready                                   |
| `mixed-ecommerce.js`         | Mixed browse workload                                |

## Lab thresholds (assumptions)

Defaults in `tests/k6/lib/helpers.js`:

| Metric                  | Lab default                   | Assumption                               |
| ----------------------- | ----------------------------- | ---------------------------------------- |
| `http_req_failed`       | `< 5%` (mixed `< 8%`)         | Local/lab noise + optional backends down |
| `http_req_duration` p95 | `< 1500ms` (mixed `< 2000ms`) | 3-node lab, cold caches OK               |
| `http_req_duration` p99 | `< 3000ms`                    | Tail latency lab                         |
| `checks` rate           | `> 95%`                       | Soft availability                        |

These are **lab gates**, not contracted production SLOs. Production targets live in `docs/SLO-SLI.md` and require operator confirmation.

## How to run

```powershell
# Install k6 separately (operator). Validate syntax:
.\scripts\k6-validate.ps1

$env:BASE_URL='http://127.0.0.1:3000'
$env:VUS='5'
$env:DURATION='30s'
k6 run tests/k6/storefront-browse.js
k6 run tests/k6/mixed-ecommerce.js
```

```bash
./scripts/k6-validate.sh
BASE_URL=http://127.0.0.1:3000 VUS=5 DURATION=30s k6 run tests/k6/catalog-listing.js
```

## Safe data

- Default scenarios are **read-only** health + catalog list.
- Mutating cart requires `CART_MUTATE=1` and still must not print tokens.
- Do not point at production credentials or live payment providers.

## Related

- `docs/SLO-SLI.md`
- `docs/RESILIENCE-TESTING.md`
- `docs/TESTING.md`
