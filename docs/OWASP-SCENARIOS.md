# OWASP Scenarios — NexaTech Security Lab

**ADR-044 — Always-on:** Intentional vulnerabilities are **ALWAYS active** in every environment. There is no toggle (`NEXATECH_SECURITY_LAB`, `FORCE_SECURE`, or deploy-profile gate). Policies in `@nexatech/shared-security-lab` hardcode the vulnerable branch for WAF / API Security appliance PoC.

Public browser guides (no auth):

- `/security-guide/guides/owasp-api-top10` (authenticated Security Guide)
- `/security-guide/guides/owasp-web-top10` (authenticated Security Guide)

Official references:

- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Web Top 10:2025](https://owasp.org/Top10/2025/)

PoC / tests: `pnpm security:test:secure`, `SECURITY_LAB_ACK=YES pnpm security:test:lab`, `pnpm security:validate`. Policies live in `libs/shared/security-lab`.

**Committed intentional count:** core SC-01…SC-67 + SC-70…SC-75 + **SC-76…SC-95** HTTP-executable extras. Non-contiguous IDs preserved for history.

**Density target:** ~30+ API-mapped and ~30+ Web-mapped scenario IDs in the matrices below (overlap OK).

| Extra ID | Primary | Endpoint / flow |
| -------- | ------- | --------------- |
| SC-70 | API2 / A04 | `GET /lab/jwt-alg-none` + `GET /api/v1/auth/me` accepts `alg=none` |
| SC-71 | A01 | Storefront `/dang-nhap?next=` open redirect |
| SC-72 | A05 | `/tim-kiem?q=` reflected XSS |
| SC-73 | A08 | Storefront `POST /api/auth/login` skips CSRF Origin |
| SC-74 | A02 | Storefront middleware empty `frameProtectionHeaders` |
| SC-75 | A07 | Login `AppError.details` PII / enumeration |
| SC-76 | API5 / A01 | `POST /api/v1/admin/users` create (BFLA) |
| SC-77 | API5 / A01 | `POST\|DELETE /api/v1/admin/users/:id/disable` soft-disable |
| SC-78 | API1 / A01 | `GET /api/v1/auth/sessions/:userId` session IDOR |
| SC-79 | API1 / A01 | `DELETE /api/v1/auth/sessions/:sessionId` revoke IDOR |
| SC-80 | API2 / A07 | `POST /api/v1/auth/forgot-password` returns `exists` |
| SC-81 | API8 / A05 | forgot-password `X-Forwarded-Host` → poisoned `resetUrl` |
| SC-82 | API8 / A02 | login `Cache-Control: public` |
| SC-83 | API8 / A09 | `GET /lab/reflect-headers` header reflection |
| SC-84 | API2 / A07 | `GET /api/v1/auth/me?access_token=` |
| SC-85 | API3 / A07 | admin create accepts weak password (`acceptWeakPassword`) |
| SC-86 | API2 / A04 | `GET /lab/login-get?email=&password=` |
| SC-87 | API3 / A01 | `POST /api/v1/auth/register` accepts `roles` |
| SC-88 | API8 / A10 | `GET /lab/error-stack` raw stack |
| SC-89 | API8 / A02 | CORS `credentials:true` + reflected Origin (identity) |
| SC-90 | API9 / A02 | `GET /lab/api-inventory` + `/docs-json` |
| SC-91 | A02 | `GET /lab/set-cookie` insecure Set-Cookie |
| SC-92 | API2 / A07 | `GET /lab/verify-bypass?email=` skip OTP |
| SC-93 | API2 / A04 | `GET /lab/oauth-callback` token in `Location` |
| SC-94 | API8 / A05 | `GET /lab/content-type?type=` dangerous MIME accepted |
| SC-95 | API3 / A01 | `GET /api/v1/admin/users/export` bulk dump |

SSRF SC-59 **fetches** via `GET /lab/ssrf-probe?url=` (timeout capped).

---

## Scenario catalog (selected)

| Scenario ID | Primary OWASP         | Component                 | Vulnerable endpoint/flow            | Vulnerable evidence        | Control           |
| ----------- | --------------------- | ------------------------- | ----------------------------------- | -------------------------- | ----------------- |
| SC-01…07    | API1 / A01            | multi-service             | resource by id                      | cross-user allow           | always-on         |
| SC-08       | API5 / A01            | shared policies           | admin function gate                 | Customer allowed           | always-on         |
| SC-10,31    | API3                  | admin users / DTO         | mass assignment / leak              | roles + passwordHash       | always-on         |
| SC-12,16    | API6                  | policies                  | price / idempotency                 | client trusted             | policy (+ wire)   |
| SC-17,18,20 | API6 / A08            | payment/shipping          | replay / sig / amount               | forged OK                  | always-on         |
| SC-21,24    | API4 / API2 / A07     | identity                  | login / OTP                         | no limit; `000000`         | always-on         |
| SC-28,30,67 | A02 / API8            | cookies/CORS/debug        | insecure flags; reflect; debug      | evil origin; dump          | always-on         |
| SC-33,36    | A01 / API1            | BFF / media               | path traversal / media access       | `..` / always allow        | always-on         |
| SC-57…66    | API4–10 / A03–A10     | identity/catalog/shipping | pageSize / SSRF / SQLi / audit / …  | see prior catalog rows     | always-on         |
| SC-70…75    | mixed                 | identity + storefront     | JWT/XSS/CSRF/frames/PII             | HTTP executable            | always-on         |
| SC-76…95    | mixed                 | identity lab + admin      | create/disable/sessions/lab probes  | HTTP executable            | always-on         |

Full historical rows for SC-01…SC-67 remain valid; extras SC-70+ are listed above and in the matrices.

---

## OWASP API Security Top 10:2023 coverage matrix (~30+ mapped)

| Category | Scenario IDs (API-mapped) | Live HTTP evidence (examples) | Control |
| -------- | ------------------------- | ----------------------------- | ------- |
| API1 BOLA | SC-01,02,03,04,05,06,07,36,78,79 | `GET /orders/:id`, sessions IDOR | always-on |
| API2 Broken Auth | SC-24,70,75,80,84,86,92,93 | OTP `000000`, alg=none, forgot exists, JWT query, login-get, verify-bypass, oauth Location | always-on |
| API3 Property / mass assign | SC-10,31,85,87,95 | PATCH roles, DTO leak, weak password create, register roles, `/admin/users/export` | always-on |
| API4 Resource consumption | SC-21,57 | login spam, `pageSize=99999` | always-on |
| API5 BFLA | SC-08,76,77 | Customer → admin users create/disable/list | always-on |
| API6 Business flows | SC-12,16,17,20,58 | price trust, idempotency, VNPay replay/amount, checkout spam | always-on |
| API7 SSRF | SC-59 | `GET /lab/ssrf-probe?url=` fetch | always-on |
| API8 Misconfiguration | SC-28,30,67,81,82,83,88,89,90,91,94 | debug, CORS+credentials, host poison, Cache-Control, reflect-headers, error-stack, inventory, set-cookie, content-type | always-on |
| API9 Inventory | SC-60,90 | `/api/v0/internal/routes`, `/lab/api-inventory`, `/docs-json` | always-on |
| API10 Unsafe API consumption | SC-61,62 | shipping webhook trust, supply-chain digest | always-on |

**API-mapped unique IDs (≥30):** SC-01,02,03,04,05,06,07,08,10,12,16,17,20,21,24,28,30,31,36,57,58,59,60,61,62,67,70,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95 (+ SC-18 secondary).

---

## OWASP Web Top 10:2025 coverage matrix (~30+ mapped)

| Category | Scenario IDs (Web-mapped) | Live HTTP / browser evidence | Control |
| -------- | ------------------------- | ---------------------------- | ------- |
| A01 Access Control | SC-01,02,03,04,05,06,07,08,33,36,71,76,77,78,79,87,95 | IDOR/BFLA/path/open-redirect/admin create/disable/sessions/register roles/export | always-on |
| A02 Misconfiguration | SC-28,30,67,74,82,89,90,91 | cookies, CORS, debug, clickjacking headers, Cache-Control, credentials CORS, inventory, set-cookie | always-on |
| A03 Supply Chain | SC-62 | `GET /lab/supply-chain?digest=` | always-on |
| A04 Crypto Failures | SC-24,66,70,86,93 | OTP, weak secret compare, alg=none, GET password, token in Location | always-on |
| A05 Injection | SC-63,72,81,83,94 | ORDER BY SQLi, XSS search, host header, header reflect, dangerous MIME | always-on |
| A06 Insecure Design | SC-12,20,58 | price trust, amount mismatch, checkout quota | always-on |
| A07 Auth Failures | SC-21,24,75,80,84,85,92 | no rate limit, OTP, PII details, exists enum, JWT query, weak password, verify bypass | always-on |
| A08 Integrity | SC-17,18,61,73 | replay, forged sig, forged webhook, CSRF Origin skip | always-on |
| A09 Logging | SC-64,83 | audit suppress, reflected trace headers | always-on |
| A10 Exceptional Conditions | SC-65,88 | `/health/debug?fail=1`, `/lab/error-stack` | always-on |

**Web-mapped unique IDs (≥30):** SC-01,02,03,04,05,06,07,08,12,17,18,20,21,24,28,30,33,36,58,61,62,63,64,65,66,67,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95.

---

## Always-on verification (ADR-044)

There is **no secure branch** and **no env dual-gate**. `pnpm security:test:secure` and `security:test:lab` both assert intentional vulnerable behavior in `@nexatech/shared-security-lab` (+ BFF sanitizer tests).

```powershell
pnpm security:test:secure
$env:SECURITY_LAB_ACK='YES'; pnpm security:test:lab
$env:SECURITY_LAB_ACK='YES'; pnpm security:smoke
pnpm security:validate
```

PoC runners refuse non-private targets and require `SECURITY_LAB_ACK=YES` for HTTP smoke against a live stack.

Swagger / OpenAPI mapping: `docs/SWAGGER-LINKS.md`. Lab console UI: `http://localhost:3100/security-lab`. Public guides: `/lab/owasp-api-top10.html`, `/lab/owasp-web-top10.html`. Combined spec: `openapi/nexatech-combined.openapi.yaml`.

## Coverage confirmation rule

A category is marked covered only when **all** of the following exist:

1. Intentional vulnerable implementation on a live request path (always-on)
2. Automated assertion (`policies.spec` and/or service/BFF path)
3. Documented remediation note in this file or related security docs
4. Executable PoC steps in public HTML guides and/or this catalog
5. No runtime opt-out toggle (ADR-044)
