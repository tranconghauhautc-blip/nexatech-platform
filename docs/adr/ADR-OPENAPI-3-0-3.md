# ADR: OpenAPI 3.0.3 is the mandatory specification version

- Status: Accepted
- Date: 2026-08-01
- Deciders: NexaTech platform maintainers

## Context

NexaTech OpenAPI artifacts are consumed by Swagger UI, Burp Suite, OWASP ZAP, Postman, Insomnia, and NestJS `@nestjs/swagger`. Toolchains have uneven OpenAPI 3.1/3.2 support. A mixed repository (3.0.0 service specs + 3.0.3 combined) causes validation and import drift.

## Decision

All NexaTech OpenAPI documents **must** declare:

```yaml
openapi: 3.0.3
```

This applies to:

- 14 per-service specs (`openapi/*-service.openapi.{yaml,json}`)
- Combined specs (`nexatech-combined.openapi.{yaml,json}`)
- Live `/docs-json` documents from Nest services
- Generators/validators (`pnpm openapi:*`)

Do **not** upgrade to OpenAPI 3.1.x or 3.2.x without a new ADR.

## Consequences

### Positive

- Predictable Burp / ZAP / Postman imports
- Compatible with current `@nestjs/swagger` document emission (forced to 3.0.3 after create)
- Single validation rule in `openapi:validate`

### Negative / limitations vs 3.1

- No native JSON Schema 2020-12 features from OpenAPI 3.1
- `nullable: true` style remains 3.0.x

### Enforcement

- `scripts/openapi/yaml.cjs` always sets `openapi: 3.0.3`
- `setupNexaTechSwagger` sets `document.openapi = '3.0.3'`
- `openapi:validate` / `openapi:diff` fail if version ≠ 3.0.3
- `pnpm openapi:check` = generate → combine → validate → diff

## Server ordering

1. Direct local service (`http://localhost:{port}`)
2. Kong local (`http://localhost:8000`)
3. Kubernetes / origin placeholder
4. `https://api.example.invalid` — **last**, Try-it-out forbidden
