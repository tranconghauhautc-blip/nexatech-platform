# OWASP Web Top 10:2025 — Matrix

> Independent from API Top 10. Do not copy API rows and rename.

| Category | Primary SSoT IDs | Status | Notes |
| --- | --- | --- | --- |
| A01 Broken Access Control | NX-WEB-003, NX-API-001, NX-API-078 | EXPLOITABLE | Open redirect + IDOR |
| A02 Misconfiguration | NX-WEB-002, NX-WEB-004, NX-API-089 | EXPLOITABLE | Cookie flags + clickjacking + CORS |
| A03 Supply Chain | NX-API-010 | EXPLOITABLE (secondary) | Digest/webhook trust |
| A04 Cryptographic Failures | NX-API-070, NX-API-086, NX-API-093 | EXPLOITABLE | alg=none, GET password, oauth leak |
| A05 Injection | NX-WEB-001, NX-WEB-005, NX-API-081, NX-API-094 | EXPLOITABLE | XSS, SQLi, host poison, content-type |
| A06 Insecure Design | NX-API-006 | PARTIAL | Business-flow design gaps |
| A07 Authentication Failures | NX-API-002, NX-API-075, NX-API-080, NX-API-084, NX-API-092 | EXPLOITABLE | Enum / bypass / query token |
| A08 Integrity Failures | NX-API-073 | EXPLOITABLE | Login CSRF Origin skip |
| A09 Logging Failures | NX-API-083 | EXPLOITABLE | Header reflection / log injection |
| A10 Exceptional Conditions | NX-WEB-006, NX-API-088 | EXPLOITABLE | health/debug + error-stack |

**Web cats present in SSoT:** A01–A10 all have at least one primary or secondary mapping.
