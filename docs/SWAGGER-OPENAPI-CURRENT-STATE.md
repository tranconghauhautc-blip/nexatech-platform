# Swagger / OpenAPI — Current State

> Updated during re-baseline. Specs regenerated with OpenAPI **3.0.3**.

## Commands

```powershell
pnpm openapi:generate
pnpm openapi:combine
pnpm openapi:validate
pnpm openapi:diff
pnpm openapi:check
```

## Artifacts

- `openapi/*-service.openapi.{yaml,json}` — 14/14, `openapi: 3.0.3`
- `openapi/nexatech-combined.openapi.{yaml,json}` — `openapi: 3.0.3`, ~375 paths (last generate)

## Servers (per-service export)

1. Direct `http://localhost:{port}`
2. Kong `http://localhost:8000`
3. K8s placeholder
4. `https://api.example.invalid` (last — do not Try it out)

## UI

| UI                | URL                             |
| ----------------- | ------------------------------- |
| Combined (Kong)   | http://localhost:8000/docs      |
| Combined (direct) | http://localhost:8090/docs      |
| Per-service       | http://localhost:3001–3014/docs |

## ADR

`docs/adr/ADR-OPENAPI-3-0-3.md`
