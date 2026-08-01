# OWASP API Security Top 10:2023 — Matrix

> Independent from Web Top 10. Status: EXPLOITABLE | PARTIAL | DOCUMENTATION_ONLY | BROKEN | MISSING.
> Source: `security-scenarios/scenarios.json` (+ legacy `docs/OWASP-SCENARIOS.md`).

| Category | Primary SSoT IDs | Status | Notes |
| --- | --- | --- | --- |
| API1 BOLA | NX-API-001, NX-API-078, NX-API-079 | EXPLOITABLE | Order + session IDOR |
| API2 Broken Auth | NX-API-002, NX-API-070, NX-API-075, NX-API-080, NX-API-084, NX-API-086, NX-API-092, NX-API-093 | EXPLOITABLE | Enum, alg=none, query token, GET login, verify bypass |
| API3 BOPLA | NX-API-003, NX-API-087, NX-API-095 | EXPLOITABLE | Admin create / register roles / export |
| API4 Resource consumption | NX-API-004 | EXPLOITABLE | pageSize=99999 |
| API5 BFLA | NX-API-005, NX-API-076, NX-API-077 | EXPLOITABLE | Admin users create/disable |
| API6 Business flows | NX-API-006 | PARTIAL | Checkout price/quota |
| API7 SSRF | NX-API-007 | EXPLOITABLE | `/lab/ssrf-probe` |
| API8 Misconfig | NX-API-008, NX-API-081, NX-API-083, NX-API-088, NX-API-089, NX-API-094 | EXPLOITABLE | CORS, stack, headers, host poison |
| API9 Inventory | NX-API-009, NX-API-090 | EXPLOITABLE | `/lab/api-inventory` |
| API10 Unsafe consumption | NX-API-010 | EXPLOITABLE | Webhook/digest trust |

**Count:** see `security-scenarios/scenarios.json` (36 scenarios; API1–API10 all represented).
