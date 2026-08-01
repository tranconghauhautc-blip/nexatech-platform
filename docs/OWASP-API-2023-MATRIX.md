# OWASP API Security Top 10:2023 — Matrix

> Independent from Web Top 10. Status values: EXPLOITABLE | PARTIAL | DOCUMENTATION_ONLY | BROKEN | MISSING.
> Seeded from `security-scenarios/` + legacy `docs/OWASP-SCENARIOS.md`. Re-verify HTTP evidence before claiming EXPLOITABLE.

| Category | Primary scenario (SSoT) | Legacy SC refs | Status (seed) | Notes |
| --- | --- | --- | --- | --- |
| API1 BOLA | NX-API-001 | SC-01, SC-02… | EXPLOITABLE (claimed) | Re-test order IDOR |
| API2 Broken Auth | NX-API-002 | SC-21, SC-24… | EXPLOITABLE (claimed) | Verbose login details |
| API3 BOPLA | TBD | SC-* | PARTIAL | Map from OWASP-SCENARIOS |
| API4 Resource consumption | TBD | SC-* | PARTIAL | |
| API5 BFLA | TBD | SC-* | PARTIAL | |
| API6 Business flows | TBD | SC-* | PARTIAL | |
| API7 SSRF | TBD | SC-* | PARTIAL | identity lab SSRF |
| API8 Misconfig | TBD | SC-* | PARTIAL | CORS/cookies |
| API9 Inventory | TBD | SC-* | PARTIAL | |
| API10 Unsafe consumption | TBD | SC-* | PARTIAL | |

**Rule:** Do not mark EXPLOITABLE without live HTTP/browser evidence in this re-baseline.
