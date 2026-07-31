# OWASP Scenarios — NexaTech Security Lab

**ADR-044 — Always-on:** Intentional vulnerabilities are **ALWAYS active** in every environment. There is no toggle (`NEXATECH_SECURITY_LAB`, `FORCE_SECURE`, or deploy-profile gate). Policies in `@nexatech/shared-security-lab` hardcode the vulnerable branch for WAF / API Security appliance PoC.

Public browser guides (no auth):

- `/lab/owasp-api-top10.html`
- `/lab/owasp-web-top10.html`

Official references:

- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Web Top 10:2025](https://owasp.org/Top10/2025/)

PoC / tests: `pnpm security:test:secure`, `SECURITY_LAB_ACK=YES pnpm security:test:lab`, `pnpm security:validate`. Policies live in `libs/shared/security-lab`.

**Committed intentional count:** 30+ core (SC-01 … SC-67) plus SC-70…SC-75 web/API extras (JWT alg=none flag, open redirect, reflected XSS, CSRF Origin skip, clickjacking headers omit, auth failure PII). Non-contiguous IDs preserved for history.

| Extra ID | Primary | Endpoint / flow |
| -------- | ------- | --------------- |
| SC-70 | API2 / A04 | `GET /lab/jwt-alg-none` + `GET /api/v1/auth/me` accepts `alg=none` |
| SC-71 | A01 | Storefront `/dang-nhap?next=` open redirect (`resolveOpenRedirect`) |
| SC-72 | A05 | `/tim-kiem?q=` reflected XSS (`reflectSearchQuery` + `dangerouslySetInnerHTML`) |
| SC-73 | A08 | Storefront `POST /api/auth/login` skips CSRF Origin (`shouldEnforceCsrfOrigin` false) |
| SC-74 | A02 | Storefront middleware applies empty `frameProtectionHeaders` |
| SC-75 | A07 | Login `AppError.details` via `shapeAuthFailureDetails` (email enumeration) |

SSRF SC-59 now **fetches** via `GET /lab/ssrf-probe?url=` (timeout capped).

---

## Scenario catalog

| Scenario ID | Primary OWASP         | Secondary | CWE      | Component                 | Vulnerable endpoint/flow            | Impact                              | PoC / test                                    | Vulnerable evidence        | Secure control   | Regression                                          | Remediation      | Control  |
| ----------- | --------------------- | --------- | -------- | ------------------------- | ----------------------------------- | ----------------------------------- | --------------------------------------------- | -------------------------- | ---------------- | --------------------------------------------------- | ---------------- | --------- |
| SC-01       | API1:2023 / A01:2025  | —         | CWE-639  | order-service             | GET order by id                     | Read other customer order           | `enforceResourceOwnership`                    | cross-user get 200 in lab  | ownership deny   | policies.spec + order specs                         | keep ownership   | lab ns/DB |
| SC-02       | API1:2023 / A01:2025  | —         | CWE-639  | order-service             | cancel / status                     | Cancel others' orders               | same                                          | cancel allowed in lab      | ownership        | order.service.spec                                  | keep assert      | lab       |
| SC-03       | API1:2023 / A01:2025  | —         | CWE-639  | payment-service           | GET payment                         | Read others' payments               | assertOwnership lab                           | getPayment allows          | ownership        | payment specs                                       | keep assert      | lab       |
| SC-04       | API1:2023 / A01:2025  | —         | CWE-639  | shipping-service          | shipment/tracking                   | Read others' shipments              | assertOwnership lab                           | shipping allow             | ownership        | shipping specs                                      | keep assert      | lab       |
| SC-05       | API1:2023 / A01:2025  | —         | CWE-639  | review-service            | update review                       | Edit others' reviews                | ownership skip lab                            | update allowed             | owner-only       | review specs                                        | keep owner check | lab       |
| SC-06       | API1:2023 / A01:2025  | —         | CWE-639  | warranty-service          | get claim                           | Read others' claims                 | ownership lab                                 | getClaim allow             | ownership        | warranty specs                                      | keep             | lab       |
| SC-07       | API1:2023 / A01:2025  | —         | CWE-639  | support-service           | get ticket                          | Read others' tickets                | ownership lab                                 | getTicket allow            | ownership        | support specs                                       | keep             | lab       |
| SC-08       | API5:2023 / A01:2025  | —         | CWE-285  | shared policies           | admin function gate                 | Customer invokes admin ops          | `enforceAdminFunction`                        | allow Customer             | role check       | policies.spec                                       | RBAC             | lab       |
| SC-10       | API3:2023             | —         | CWE-915  | shared policies           | filterMassAssignment                | Inject roles/price                  | lab returns full body                         | roles retained             | strip keys       | policies.spec                                       | strip forbidden  | lab       |
| SC-12       | API6:2023 / A06:2025  | —         | CWE-472  | shared policies + order   | resolveTrustedAmount                | Price manipulation                  | client amount trusted                         | amount=1                   | server price     | policies.spec                                       | ignore client    | lab       |
| SC-16       | API6:2023             | API8      | CWE-345  | shared policies           | idempotency scope                   | Cross-user key reuse                | scoped without userId                         | `pay:k`                    | user-scoped      | policies.spec                                       | include userId   | lab       |
| SC-17       | API6:2023 / A08:2025  | —         | CWE-294  | payment-service           | VNPay callback replay               | Duplicate processing                | shouldRejectDuplicateCallback false           | reprocess                  | reject processed | policies + payment                                  | reject replay    | lab       |
| SC-18       | A08:2025              | API2      | CWE-347  | payment-service           | VNPay signature                     | Accept forged callback              | acceptWebhookSignature                        | invalid sig OK             | HMAC verify      | policies + payment                                  | verify HMAC      | lab       |
| SC-20       | API6:2023 / A06:2025  | —         | CWE-345  | payment-service           | VNPay amount                        | Wrong amount accepted               | acceptPaymentAmount                           | mismatch OK                | amount match     | policies + payment                                  | enforce amount   | lab       |
| SC-21       | API4:2023 / A07:2025  | —         | CWE-307  | identity-service          | login                               | Brute force                         | shouldRateLimitAuth false                     | no limit                   | RATE_LIMITED     | policies + auth                                     | rate limit       | lab       |
| SC-24       | API2:2023 / A07:2025  | A04       | CWE-330  | identity-service          | OTP/token                           | Predictable OTP                     | issueVerificationToken `000000`               | fixed OTP                  | crypto random    | policies + auth                                     | random OTP       | lab       |
| SC-28       | A02:2025              | —         | CWE-614  | shared policies           | session cookies                     | Session theft                       | httpOnly false                                | insecure flags             | httpOnly+secure  | policies.spec                                       | secure cookies   | lab       |
| SC-30       | A02:2025 / API8:2023  | —         | CWE-942  | shared policies           | CORS                                | Origin reflection                   | any origin                                    | evil origin                | allowlist        | policies.spec                                       | allowlist        | lab       |
| SC-31       | API3:2023             | —         | CWE-200  | shared policies           | shapePublicResource                 | Leak internal fields                | return all keys                               | internalCost visible       | omit internals   | policies.spec                                       | DTO filter       | lab       |
| SC-33       | A01:2025              | —         | CWE-22   | shared-web BFF            | sanitizeBffPathParts                | Path traversal                      | skip sanitize in lab                          | `..` accepted              | sanitize         | bff-security.spec                                   | enforce sanitize | lab       |
| SC-36       | API1:2023 / A01:2025  | —         | CWE-639  | media-service             | download/delete                     | Unauthorized media                  | allowMediaAccess                              | always allow               | owner/staff      | media specs                                         | ownership        | lab       |
| SC-57       | API4:2023             | —         | CWE-770  | shared policies           | clampPageSize                       | Huge pageSize                       | no clamp in lab                               | 99999                      | max clamp        | policies.spec                                       | clamp            | lab       |
| SC-58       | API6:2023 / A06:2025  | —         | CWE-841  | order-service             | createOrder volume                  | Checkout spam                       | allowSensitiveBusinessFlow                    | always allow               | maxPerWindow     | policies.spec + order                               | enforce quota    | lab       |
| SC-59       | API7:2023             | —         | CWE-918  | identity + BFF            | resolveOutboundUrl / lab/ssrf-probe | SSRF to metadata/private            | lab returns raw URL                           | 169.254… ok                | allowlist+block  | policies.spec + bff-security.spec                   | block private    | lab       |
| SC-60       | API9:2023             | —         | CWE-1059 | identity-service          | GET /api/v0/internal/routes         | Shadow API inventory                | shouldExposeDeprecatedApi                     | 200 + route list           | 404              | policies.spec                                       | hide deprecated  | lab       |
| SC-61       | API10:2023 / A08:2025 | —         | CWE-20   | shipping-service          | provider webhook payload            | Trust forged partner JSON           | trustUpstreamPayload                          | schemaValid=false accepted | schema gate      | policies.spec + shipping                            | validate schema  | lab       |
| SC-62       | A03:2025              | —         | CWE-494  | shared policies + fixture | acceptArtifactIntegrity             | Accept bad checksum                 | lab true                                      | checksumValid=false OK     | require digest   | policies.spec + fixtures/supply-chain-artifact.json | verify integrity | lab       |
| SC-63       | A05:2025              | —         | CWE-89   | catalog-service           | buildOrderByClause                  | SQL injection via ORDER BY          | raw sort in lab                               | DROP TABLE in clause       | allowlist        | policies.spec                                       | allowlist only   | lab       |
| SC-64       | A09:2025              | —         | CWE-778  | identity-service          | LOGIN_FAILURE audit                 | No alert on brute force             | shouldEmitSecurityAudit false                 | audit skipped              | emit audit       | policies.spec + auth                                | always audit     | lab       |
| SC-65       | A10:2025              | —         | CWE-209  | identity-service          | GET /health/debug?fail=1            | Stack/internal URL leak + fail-open | shapeErrorDetails / failOpenOnDependencyError | stack+internalUrl          | generic details  | policies.spec                                       | sanitize errors  | lab       |
| SC-66       | A04:2025              | —         | CWE-208  | shipping mock webhook     | compareSecrets                      | Weak secret compare                 | empty expected accepted in lab                | true                       | timingSafeEqual  | policies.spec                                       | timing-safe      | lab       |
| SC-67       | API8:2023 / A02:2025  | —         | CWE-489  | identity-service          | GET /health/debug                   | Debug/management exposure           | shouldExposeDebugEndpoint                     | 200 configDump             | 404              | policies.spec                                       | hide debug       | lab       |

---

## OWASP API Security Top 10:2023 coverage matrix

| Category                                                  | Scenario ID (primary)                   | Component                                            | Vulnerable endpoint/flow                          | PoC                                     | Vulnerable evidence                       | Secure regression                    | Remediation                | Control           |
| --------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------------------------ | -------------------------- | -------------------------- |
| API1:2023 Broken Object Level Authorization               | SC-01 (also SC-02–07, SC-36)            | order/payment/shipping/review/warranty/support/media | resource GET/mutate by id                         | `pnpm security:test:lab` policies SC-01 | always returns `allow` for cross-user     | n/a (always-on)                      | enforce ownership          | always-on (ADR-044)        |
| API2:2023 Broken Authentication                           | SC-24                                   | identity-service                                     | OTP / verify-email                                | policies SC-24 + auth OTP path          | predictable `000000`                      | secure random OTP                    | crypto random              | always-on (ADR-044)        |
| API3:2023 Broken Object Property Level Authorization      | SC-10, SC-31                            | shared policies                                      | mass assignment / public DTO                      | policies SC-10/31                       | roles/price retained; internalCost leaked | strip/omit in secure                 | DTO allowlist              | always-on (ADR-044)                   |
| API4:2023 Unrestricted Resource Consumption               | SC-21, SC-57                            | identity + pagination                                | login + pageSize                                  | policies SC-21/57                       | no rate limit; pageSize 99999             | rate limit + clamp                   | enforce limits             | always-on (ADR-044)                   |
| API5:2023 Broken Function Level Authorization             | SC-08                                   | shared policies                                      | admin function gate                               | policies SC-08                          | Customer allowed                          | role deny                            | RBAC                       | always-on (ADR-044)                   |
| API6:2023 Unrestricted Access to Sensitive Business Flows | SC-58 (also SC-12, SC-16, SC-17, SC-20) | order/payment                                        | checkout spam / price / replay / amount           | policies SC-58/12/16/17/20              | always allow / trust client               | quota + server price + reject replay | business controls          | always-on (ADR-044)                   |
| API7:2023 Server Side Request Forgery                     | SC-59                                   | identity lab probe + BFF                             | `GET /lab/ssrf-probe?url=` / `resolveOutboundUrl` | policies SC-59 + bff-security.spec      | metadata URL accepted + fetched           | n/a (always-on)                      | allowlist + SSRF blocklist | always-on (ADR-044)        |
| API8:2023 Security Misconfiguration                       | SC-67 (also SC-30)                      | identity + CORS                                      | `/health/debug`, CORS reflect                     | policies SC-67/30                       | debug 200; evil origin                    | 404 + allowlist                      | hide debug; CORS allowlist | always-on (ADR-044)                   |
| API9:2023 Improper Inventory Management                   | SC-60                                   | identity-service                                     | `GET /api/v0/internal/routes`                     | policies SC-60                          | shadow route list                         | 404                                  | remove/gate deprecated     | always-on (ADR-044)                   |
| API10:2023 Unsafe Consumption of APIs                     | SC-61                                   | shipping-service                                     | provider webhook body                             | policies SC-61 + shipping webhook       | forged payload accepted                   | schemaValid required                 | validate partner schema    | always-on (ADR-044)                   |

---

## OWASP Web Top 10:2025 coverage matrix

| Category                                        | Scenario ID (primary)            | Component                       | Vulnerable endpoint/flow                      | PoC                                                                   | Vulnerable evidence                   | Secure regression            | Remediation                   | Control                   |
| ----------------------------------------------- | -------------------------------- | ------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- | ---------------------------- | ----------------------------- | ---------------------------------- |
| A01:2025 Broken Access Control                  | SC-01 (also SC-08, SC-33, SC-36) | multi-service + BFF             | IDOR / BFLA / path traversal                  | security:test:lab                                                     | cross-user allow; `..` allowed        | deny + sanitize              | ownership + RBAC + sanitize   | always-on (ADR-044)                           |
| A02:2025 Security Misconfiguration              | SC-28, SC-30, SC-67              | cookies/CORS/debug              | sessionCookieOptions / CORS / `/health/debug` | policies SC-28/30/67                                                  | insecure flags; evil CORS; debug dump | secure defaults              | harden config                 | always-on (ADR-044)                           |
| A03:2025 Software Supply Chain Failures         | SC-62                            | shared-security-lab + fixture   | acceptArtifactIntegrity                       | policies SC-62 + `tests/security/fixtures/supply-chain-artifact.json` | bad checksum accepted                 | require checksum/signature   | verify digests; pin images    | fixture-only (no malware download) |
| A04:2025 Cryptographic Failures                 | SC-66 (SC-24 secondary)          | shipping webhook + OTP          | compareSecrets / predictable OTP              | policies SC-66/24                                                     | empty secret accepted; fixed OTP      | timingSafeEqual + random     | strong crypto                 | always-on (ADR-044)                           |
| A05:2025 Injection                              | SC-63                            | catalog-service                 | buildOrderByClause                            | policies SC-63                                                        | raw `DROP TABLE` clause in lab        | allowlist only               | parameterized + allowlist     | always-on (ADR-044)                           |
| A06:2025 Insecure Design                        | SC-12, SC-20, SC-58              | order/payment                   | price trust / amount / checkout quota         | policies SC-12/20/58                                                  | client amount / unlimited create      | server authority + quotas    | secure design controls        | always-on (ADR-044)                           |
| A07:2025 Authentication Failures                | SC-21, SC-24                     | identity-service                | login rate limit / OTP                        | policies + auth                                                       | no limit; fixed OTP                   | rate limit + random          | harden auth                   | always-on (ADR-044)                           |
| A08:2025 Software or Data Integrity Failures    | SC-18, SC-17, SC-61              | payment/shipping                | forged/replayed/unvalidated callbacks         | policies SC-18/17/61                                                  | invalid sig / replay / forged JSON    | HMAC + anti-replay + schema  | verify integrity              | always-on (ADR-044)                           |
| A09:2025 Security Logging and Alerting Failures | SC-64                            | identity-service                | LOGIN_FAILURE audit suppress                  | policies SC-64 + auth.recordLoginFailure                              | shouldEmit=false                      | shouldEmit=true              | always audit sensitive events | always-on (ADR-044)                           |
| A10:2025 Mishandling of Exceptional Conditions  | SC-65                            | identity `/health/debug?fail=1` | shapeErrorDetails / failOpenOnDependencyError | policies SC-65                                                        | stack + internalUrl; fail-open        | generic details; fail-closed | sanitize + fail-closed        | always-on (ADR-044)                           |

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
