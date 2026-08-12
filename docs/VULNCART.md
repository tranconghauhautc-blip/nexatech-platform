# VulnCart — intentionally vulnerable API lab

## Brand

**VulnCart** (APIShop Lab style) — short name used on UI, Swagger, Helm, docs.

## Architecture (final)

```
Internet / LAN
    │
ingress-nginx (Ingress)
    ├─ /                → storefront-web
    ├─ /admin           → admin-web
    ├─ /security-guide  → security-guide-portal
    └─ /api (+ /api/docs) → backend-api (NestJS monolith)
                              │
                              └─ PostgreSQL 16 (in-cluster StatefulSet + PVC local-path)
                                 DB: vulncart · user: vulncart_app
```

**Removed from deploy path:** Kong, Redis, RabbitMQ, MinIO, external DB server, microservices mesh.

## Services

| Component | Source | Port |
|-----------|--------|------|
| backend-api | `apps/backend-api` | 3000 |
| storefront-web | `apps/vulncart-storefront` | 3100 |
| admin-web | `apps/vulncart-admin` | 3200 |
| security-guide-portal | `apps/vulncart-guide` | 3300 |
| postgres | chart template | 5432 |
| migrate Job | `Dockerfile.migrate` | — |

## Database schema

- `User` (username, passwordHash, role USER|ADMIN, enabled, metadata)
- `Product` (name, price, stock, active, metadata)
- `CartItem` (userId, productId, quantity, unitPrice*)
- `Order` / `OrderItem`
- `Review`

\* `unitPrice` on cart is intentional for price-tampering demos.

Single `DATABASE_URL`.

## Swagger

- UI: `/api/docs`
- JSON: `/api/docs-json`
- YAML: `/api/docs-yaml`
- OpenAPI 3.x · Bearer JWT · tags: Auth, Users, Products, Cart, Orders, Reviews, Admin, Lab

## Vulnerability matrix

| Theme | Endpoint / flow |
|-------|-----------------|
| BOLA / IDOR | `GET/POST /api/orders/:id`, cart item by id, `PATCH/DELETE /api/reviews/:id` |
| Broken Authentication | JWT `alg=none`, header spoof `x-user-id`/`x-user-role`, optional currentPassword, user enum on login |
| Mass Assignment / BOPLA | `role` on register & `PATCH /api/users/me` |
| BFLA | `/api/admin/*` with `?asAdmin=1` or spoofed role header |
| Unrestricted Resource Consumption | `GET /api/products?limit=100000` |
| Sensitive Business Flow | negative qty, price tamper, over-stock, double checkout, cancel completed |
| SSRF | `GET /api/lab/ssrf-probe?url=` |
| Security Misconfiguration | CORS reflect, `/api/lab/debug`, error stacks |
| Improper Inventory Management | `/api/lab/inventory`, `/api/v0/internal/users`, legacy login |
| Unsafe Consumption of APIs | `/api/lab/unsafe-consume` via `metadata.callbackUrl` |

Business checks: negative quantity, price tampering, buy over stock, double checkout, cancel completed order, review without purchase, review spam, self-promote role, read another's order, edit another's review.

## Helm resources

Chart: `deploy/helm/vulncart`

- Secret
- Postgres StatefulSet + PVC (local-path) + headless Service
- Migration Job (hook)
- Deployments+Services: backend-api, storefront-web, admin-web, security-guide
- Ingress (class nginx)

## Install

```bash
cp secret.env.example secret.env
# edit POSTGRES_PASSWORD JWT_SECRET ADMIN_USERNAME ADMIN_PASSWORD
chmod +x install.sh
./install.sh
```

Build images first (on a machine with Docker):

```bash
chmod +x scripts/vulncart-build-images.sh
REGISTRY=ghcr.io/you/vulncart TAG=1.0.0 ./scripts/vulncart-build-images.sh
PUSH=1 REGISTRY=... TAG=1.0.0 ./scripts/vulncart-build-images.sh
```

Then set image env vars before `./install.sh` or pass a values overlay.
