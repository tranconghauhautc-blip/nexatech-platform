# OWASP Web Top 10:2025 — Matrix

> Independent from API Top 10. Do not copy API rows and rename.

| Category | Primary SSoT IDs | Status | Notes |
| --- | --- | --- | --- |
| A01 Broken Access Control | NX-WEB-003, NX-API-001 | EXPLOITABLE / secondary | Open redirect + IDOR |
| A02 Misconfiguration | NX-WEB-002, NX-WEB-004 | EXPLOITABLE | Cookie flags + clickjacking headers |
| A03 Supply Chain | NX-API-010 | EXPLOITABLE (secondary) | Digest/webhook trust |
| A04 Cryptographic Failures | NX-API-070, NX-API-086 | EXPLOITABLE | alg=none, GET password |
| A05 Injection | NX-WEB-001, NX-WEB-005 | EXPLOITABLE | XSS search + ORDER BY SQLi |
| A06 Insecure Design | NX-API-006 | PARTIAL | Business-flow design gaps |
| A07 Authentication Failures | NX-API-002, NX-API-080, NX-API-092 | EXPLOITABLE | Enum / bypass |
| A08 Integrity Failures | TBD | PARTIAL | Map SC-17/18/73 next |
| A09 Logging Failures | TBD | PARTIAL | Map SC-64/83 next |
| A10 Exceptional Conditions | NX-WEB-006, NX-API-088 | EXPLOITABLE | health/debug + error-stack |

**Web cats present in SSoT:** A01,A02,A03,A04,A05,A06,A07,A10 (A08/A09 still TBD primaries).
