# CUSTOMER FUNCTIONAL ACCEPTANCE

> **2026-08-03** full runtime acceptance.

| Area | Source | Auth API | Browser | Automated | Result 2026-08-03 |
| ---- | ------ | -------- | ------- | --------- | ----------------- |
| Login customer1/2 | ✅ | 201 | PASS_BROWSER | rbac/seed | PASS_BROWSER |
| Payments `/me` | ✅ | 200 | PASS_BROWSER | Playwright | PASS_BROWSER |
| Reviews `/me` | ✅ | 200 | PASS_BROWSER | Playwright | PASS_BROWSER |
| Address VN 2-tier | ✅ | — | PASS_BROWSER | address-data **34/3321** + e2e | PASS_BROWSER |
| Pickup stores | ✅ | Kong/direct 200 | PASS_BROWSER cards | unit + seed + e2e | PASS_BROWSER |
| Checkout COD pickup | ✅ | order validates store | PASS_BROWSER real order | pickup-cod-acceptance | PASS_BROWSER |
| Order detail store | ✅ | store GET by id | PASS_BROWSER name/phone | e2e | PASS_BROWSER |
| Cart clear after order | ✅ | — | PASS_BROWSER | e2e | PASS_BROWSER |
| customer2 isolation | ✅ | — | PASS_BROWSER | e2e | PASS_BROWSER |
| Product images | ✅ | mediaLinks | — | media:audit **10/10** | PASS_RUNTIME |
