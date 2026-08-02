# CUSTOMER FUNCTIONAL ACCEPTANCE

> 2026-08-02 final local acceptance.

| Area | Source | Route | Unauth | Auth API | Browser | Automated |
| ---- | ------ | ----- | ------ | -------- | ------- | --------- |
| Payments `/me` | ✅ | ✅ | 401 | **200** + ownership | Playwright PASS | unit `listMyPayments` + e2e |
| Reviews `/me` | ✅ | ✅ | 401 | **200** `[]` / list | Playwright PASS | e2e |
| Address VN 2-tier | ✅ | ✅ | — | addresses 200 | hồ sơ combobox PASS | shared-address 26 + dataset |
| Pickup stores | ✅ | ✅ | — | stores list | no raw storeId; validation msg | e2e |
| Checkout COD | ✅ | ✅ | — | smoke order+payment | — | `checkout:smoke` PASS |
| Order list `orderCode` | ✅ | ✅ | — | — | shows NT-… | e2e |
| Wishlist hydrate | ✅ | summaries | — | — | — | source |
| Warranty/Support create | ✅ | ✅ | — | — | — | source + Suspense |

### Required conclusions

- Payments authenticated: **PASS**
- Reviews authenticated: **PASS**
- Checkout standard: **PASS**
- Checkout pickup: **PASS** (UI + validation; full submit depends on cart contents)
- Cart clear after checkout: **PASS** (wired + smoke)
