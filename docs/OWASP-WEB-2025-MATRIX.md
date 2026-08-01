# OWASP Web Top 10:2025 — Matrix

> Independent from API Top 10. Do not copy API rows and rename.
> Seeded from `security-scenarios/` + legacy docs.

| Category | Primary scenario (SSoT) | Legacy SC refs | Status (seed) | Notes |
| --- | --- | --- | --- | --- |
| A01 Broken Access Control | NX-API-001 (secondary map) | SC-* | PARTIAL | Prefer dedicated web UI IDOR |
| A02 Security Misconfiguration | TBD | SC-28 cookies… | PARTIAL | |
| A03 Supply Chain | TBD | SC-* | DOCUMENTATION_ONLY | |
| A04 Cryptographic Failures | TBD | SC-* | PARTIAL | |
| A05 Injection | NX-WEB-001 | SC-63, SC-72 | EXPLOITABLE (claimed) | Search XSS reflect |
| A06 Insecure Design | TBD | SC-* | PARTIAL | |
| A07 Authentication Failures | NX-API-002 | SC-* | PARTIAL | |
| A08 Integrity Failures | TBD | SC-* | PARTIAL | |
| A09 Logging Failures | TBD | SC-* | PARTIAL | |
| A10 Exceptional Conditions | TBD | SC-* | PARTIAL | |

**Rule:** API and Web matrices stay separate; shared scenario IDs must declare primary vs secondary mapping.
