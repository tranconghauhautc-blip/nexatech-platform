# OWASP Scenarios — NexaTech Security Lab (M21)

Intentional vulnerabilities exist **only** when:

- `NEXATECH_SECURITY_LAB=1`
- `NEXATECH_DEPLOY_PROFILE=security-lab`

Production profile (`values-production.yaml`) sets both to safe defaults. Lab uses `values-security-lab.yaml` + image tag `0.21.0-sec-lab`.

PoC / tests: `pnpm security:test:secure`, `pnpm security:test:lab` (requires `SECURITY_LAB_ACK=YES`), `libs/shared/security-lab`.

| Scenario ID | OWASP category       | CWE     | Component        | Vulnerable endpoint/flow                   | Impact                     | PoC / test                           | Vulnerable evidence               | Secure control   | Regression test                       | Remediation      | Lab isolation |
| ----------- | -------------------- | ------- | ---------------- | ------------------------------------------ | -------------------------- | ------------------------------------ | --------------------------------- | ---------------- | ------------------------------------- | ---------------- | ------------- |
| SC-01       | API1 BOLA            | CWE-639 | order-service    | GET order by id                            | Read other customer order  | `enforceResourceOwnership` lab allow | cross-user get returns 200 in lab | ownership deny   | policies.spec + order ownership tests | keep ownership   | lab ns/DB     |
| SC-02       | API1 BOLA            | CWE-639 | order-service    | cancel / status via assertOwnershipOrStaff | Cancel others' orders      | same                                 | cancel allowed in lab             | ownership        | order.service.spec                    | keep assert      | lab ns        |
| SC-03       | API1 BOLA            | CWE-639 | payment-service  | GET payment                                | Read others' payments      | assertOwnership lab                  | getPayment allows                 | ownership        | payment specs                         | keep assert      | lab           |
| SC-04       | API1 BOLA            | CWE-639 | shipping-service | shipment/tracking                          | Read others' shipments     | assertOwnership lab                  | shipping allow                    | ownership        | shipping specs                        | keep assert      | lab           |
| SC-05       | API1 BOLA            | CWE-639 | review-service   | update review                              | Edit others' reviews       | ownership skip lab                   | update allowed                    | owner-only       | review specs                          | keep owner check | lab           |
| SC-06       | API1 BOLA            | CWE-639 | warranty-service | get claim                                  | Read others' claims        | ownership lab                        | getClaim allow                    | ownership        | warranty specs                        | keep             | lab           |
| SC-07       | API1 BOLA            | CWE-639 | support-service  | get ticket                                 | Read others' tickets       | ownership lab                        | getTicket allow                   | ownership        | support specs                         | keep             | lab           |
| SC-08       | API5 BFLA            | CWE-285 | shared policies  | admin function gate                        | Customer invokes admin ops | `enforceAdminFunction` lab allow     | allow Customer                    | role check       | policies.spec                         | RBAC             | lab           |
| SC-10       | API3 Mass Assignment | CWE-915 | shared policies  | filterMassAssignment                       | Inject roles/price         | lab returns full body                | roles retained                    | strip keys       | policies.spec                         | strip forbidden  | lab           |
| SC-12       | Business logic       | CWE-472 | shared policies  | resolveTrustedAmount                       | Price manipulation         | client amount trusted in lab         | amount=1                          | server price     | policies.spec                         | ignore client    | lab           |
| SC-16       | API8 Misconfig       | CWE-345 | shared policies  | idempotency scope                          | Cross-user key reuse       | scoped without userId in lab         | `pay:k`                           | user-scoped      | policies.spec                         | include userId   | lab           |
| SC-17       | Business logic       | CWE-294 | payment-service  | VNPay callback replay                      | Duplicate processing       | shouldRejectDuplicateCallback false  | reprocess                         | reject processed | policies + payment                    | reject replay    | lab           |
| SC-18       | API7 SSRF/AuthZ      | CWE-347 | payment-service  | VNPay signature                            | Accept forged callback     | acceptWebhookSignature               | invalid sig OK                    | HMAC verify      | policies + payment                    | verify HMAC      | lab           |
| SC-20       | Business logic       | CWE-345 | payment-service  | VNPay amount                               | Wrong amount accepted      | acceptPaymentAmount                  | mismatch OK                       | amount match     | policies + payment                    | enforce amount   | lab           |
| SC-21       | API4 Resource        | CWE-307 | identity-service | login                                      | Brute force                | shouldRateLimitAuth false            | no limit                          | RATE_LIMITED     | policies + auth                       | rate limit       | lab           |
| SC-24       | API2 Auth            | CWE-330 | identity-service | OTP/token                                  | Predictable OTP            | issueVerificationToken `000000`      | fixed OTP                         | crypto random    | policies + auth                       | random OTP       | lab           |
| SC-28       | Web A05              | CWE-614 | shared policies  | session cookies                            | Session theft              | httpOnly false                       | insecure flags                    | httpOnly+secure  | policies.spec                         | secure cookies   | lab           |
| SC-30       | Web A05              | CWE-942 | shared policies  | CORS                                       | Origin reflection          | any origin                           | evil origin                       | allowlist        | policies.spec                         | allowlist        | lab           |
| SC-31       | API3 Excess data     | CWE-200 | shared policies  | shapePublicResource                        | Leak internal fields       | return all keys                      | internalCost visible              | omit internals   | policies.spec                         | DTO filter       | lab           |
| SC-33       | Web A10 SSRF         | CWE-22  | shared-web BFF   | sanitizeBffPathParts                       | Path traversal / SSRF      | skip sanitize in lab                 | `..` accepted                     | sanitize         | bff-security.spec (secure) + lab flag | enforce sanitize | lab           |
| SC-36       | API1 BOLA            | CWE-639 | media-service    | download/delete                            | Unauthorized media         | allowMediaAccess                     | always allow                      | owner/staff      | media specs                           | ownership        | lab           |
| SC-57       | API4 Resource        | CWE-770 | shared policies  | clampPageSize                              | Huge pageSize              | no clamp in lab                      | 99999                             | max clamp        | policies.spec                         | clamp            | lab           |

**Committed intentional count:** 22 scenarios (table above).

## Secure regression

Production defaults (`NEXATECH_SECURITY_LAB=0`, `deployProfile=production`) keep all secure branches. Existing service ownership unit tests continue to pass without lab env.

## PoC commands

```powershell
pnpm security:test:secure
$env:SECURITY_LAB_ACK='YES'; pnpm security:test:lab
$env:SECURITY_LAB_ACK='YES'; pnpm security:smoke
pnpm security:validate
```

PoC runners refuse non-private targets and require `SECURITY_LAB_ACK=YES` for lab mode.
