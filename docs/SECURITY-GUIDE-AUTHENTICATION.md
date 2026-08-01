# Security Guide Authentication

## Model

- Credential store: `.env.security-guide.local` (gitignored)
- Username: `SECURITY_GUIDE_USERNAME`
- Password: only as `SECURITY_GUIDE_PASSWORD_HASH` (bcrypt)
- Session: HMAC-SHA256 signed cookie `nt_security_guide_session`
- Flags: `HttpOnly`, `SameSite=Strict`, `Secure` only when served over HTTPS

## Fail closed

Missing username, password hash, or session secret → portal returns **503** “Guide unavailable”. No default operator account.

## Endpoints

| Path | Auth |
| --- | --- |
| `/security-guide/login` | Public |
| `/security-guide`, `/security-guide/*` | Session required (HTML → redirect) |
| `/security-guide/guides/*` | Session required (OWASP HTML recipes) |
| `/api/security-guide/*` | Session required (401 JSON) |
| `/health` | Public |

## Setup

See `docs/SECURITY-GUIDE-SETUP.md`.
