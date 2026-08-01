# OWASP API Security Top 10:2023 — Matrix

> Independent from Web Top 10. Status: EXPLOITABLE | PARTIAL | DOCUMENTATION_ONLY | BROKEN | MISSING.
> Source: `security-scenarios/scenarios.json` (+ legacy `docs/OWASP-SCENARIOS.md`).

| Category | Primary SSoT IDs | Status | Notes |
| --- | --- | --- | --- |
| API1 BOLA | NX-API-001, NX-API-078 | EXPLOITABLE | Order IDOR + session IDOR |
| API2 Broken Auth | NX-API-002, NX-API-070, NX-API-080, NX-API-086, NX-API-092 | EXPLOITABLE | Enum, alg=none, forgot exists, GET login, verify bypass |
| API3 BOPLA | NX-API-003, NX-API-095 | EXPLOITABLE | Admin create / export |
| API4 Resource consumption | NX-API-004 | EXPLOITABLE | pageSize=99999 |
| API5 BFLA | NX-API-005, NX-API-076 | PARTIAL / EXPLOITABLE | Admin users |
| API6 Business flows | NX-API-006 | PARTIAL | Checkout price/quota |
| API7 SSRF | NX-API-007 | EXPLOITABLE | `/lab/ssrf-probe` |
| API8 Misconfig | NX-API-008, NX-API-088 | EXPLOITABLE | CORS + error-stack |
| API9 Inventory | NX-API-009 | EXPLOITABLE | `/lab/api-inventory` |
| API10 Unsafe consumption | NX-API-010 | EXPLOITABLE | Webhook/digest trust |

**Count:** 24 scenarios in SSoT; API1–API10 all represented.
