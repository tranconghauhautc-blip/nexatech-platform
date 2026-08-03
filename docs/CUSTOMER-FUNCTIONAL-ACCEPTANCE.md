# CUSTOMER FUNCTIONAL ACCEPTANCE

> **2026-08-03** owner regression re-audit. Prior 2026-08-02 PASS claims reclassified where runtime lacked data.

| Area | Source | Auth API | Browser | Automated | Result 2026-08-03 |
| ---- | ------ | -------- | ------- | --------- | ----------------- |
| Payments `/me` | ✅ | prior 200 | prior Playwright | prior | PASS_API_ONLY this host (no password) |
| Reviews `/me` | ✅ | prior 200 | prior | prior | PASS_API_ONLY this host |
| Address VN 2-tier | ✅ | — | NOT_TESTED this pass | address-data **34/3321 PASS** | PARTIAL |
| Pickup stores | ✅ | **Kong/direct 200 HCM-NGUYEN-HUE** | needs login | unit + seed + hardened e2e | PASS_RUNTIME (API/DB); browser PARTIAL |
| Checkout COD | ✅ | — | NOT_TESTED | prior smoke | PARTIAL |
| Checkout pickup | ✅ | store validation in order-service | NOT_TESTED session | e2e requires store card | PARTIAL→data fixed |
| Order detail pickup | ✅ hydrate store | — | NOT_TESTED | — | PASS source |
| Order list `orderCode` | ✅ | — | NOT_TESTED | prior e2e | PARTIAL |
| Wishlist / Compare / Recent | ✅ | — | NOT_TESTED | — | NOT_TESTED |
| Cart | ✅ | `/carts/current` 401 unauth | NOT_TESTED | — | PASS_API_ONLY |
| Product images | ✅ | sample PDP `mediaLinks=[]`; audit 8/10 with media | — | media:audit PASS | PARTIAL / MISSING_DATA some SKUs |

### Required conclusions (honest)

- Checkout pickup **data/API:** PASS_RUNTIME after seed.
- Checkout pickup **full browser order:** NOT_TESTED without `DEV_SEED_PASSWORD`.
- Do not treat prior “PASS” as current without re-login evidence.
