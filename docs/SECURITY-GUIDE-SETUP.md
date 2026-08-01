# Security Guide Setup

Local authenticated portal for intentional vulnerability exploitation guides.

## URL

- Guide: http://localhost:3200/security-guide
- Login: http://localhost:3200/security-guide/login
- Health: http://localhost:3200/health

## One-time credential setup

```powershell
pnpm security-guide:setup
```

- Prompts for username + password (masked)
- Writes **gitignored** `.env.security-guide.local`
- Stores `SECURITY_GUIDE_PASSWORD_HASH` (bcrypt) — never plaintext password at rest
- Generates `SECURITY_GUIDE_SESSION_SECRET`

Rotate:

```powershell
pnpm security-guide:rotate-credentials
```

## Run

```powershell
pnpm security-guide:serve
# or Docker Compose service security-guide-portal on port 3200
```

Without the env file the portal **fail-closes** (HTTP 503) — no default credentials.

## Auth properties

- Server-side session (HMAC-signed cookie `nt_security_guide_session`)
- HttpOnly + SameSite=Strict
- Unauthenticated HTML → redirect login
- Unauthenticated API → 401
- Generic login failure message (no user enumeration)

## Scenario source

`security-scenarios/scenarios.json` (+ YAML twin). Expand this file; Guide reads JSON at runtime.

Do **not** put operator passwords in docs, OpenAPI, or Git.
