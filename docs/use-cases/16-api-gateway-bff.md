# 16 — API Gateway / BFF Use Cases

NexaTech frontends act as the session BFF (not Kong for local RC app traffic).
Kong is part of the target deployment stack; **runtime auth injection for apps is Next.js BFF**.

Files:

- Storefront: `apps/storefront-web/src/lib/bff-proxy.ts`, `src/app/api/bff/*/...`, `src/app/api/auth/*`
- Admin: `apps/admin-web/src/lib/bff-proxy.ts`, `src/app/api/bff/*/...`, `src/app/api/auth/*`

Upstream always: `{SERVICE_URL}/api/v1/{path}`.

---

## UC-BFF-01 — Session cookie → service headers

| Field                             | Content                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-BFF-01                                                                                                                                  |
| **Name**                          | Tiêm danh tính phiên / Inject session identity                                                                                             |
| **Actor**                         | A01 (no headers), A02–A06 (session)                                                                                                        |
| **Supporting actors/services**    | storefront/admin BFF; identity tokens in cookie                                                                                            |
| **Preconditions**                 | Valid session cookie when authenticated                                                                                                    |
| **Trigger**                       | Any `/api/bff/*` call                                                                                                                      |
| **Input**                         | Cookie session JSON                                                                                                                        |
| **Main flow**                     | Read cookie → set `x-user-id`, `x-user-roles` (comma-joined), `Authorization: Bearer {accessToken}`; storefront may forward `x-cart-token` |
| **Alternate flows**               | Guest: no user headers; cart token only                                                                                                    |
| **Error flows**                   | Invalid cookie → treat unauthenticated / 401 on auth routes                                                                                |
| **Authorization**                 | BFF is trust boundary for backends                                                                                                         |
| **Database changes**              | None                                                                                                                                       |
| **Events produced**               | None                                                                                                                                       |
| **Events consumed**               | None                                                                                                                                       |
| **API endpoints**                 | All `/api/bff/{service}/[...path]`                                                                                                         |
| **Response contract**             | Proxied success DTOs or BFF error envelope (`BFF_*`, `UPSTREAM_UNAVAILABLE`)                                                               |
| **Idempotency rule**              | Transparent proxy                                                                                                                          |
| **Postconditions**                | Downstream sees actor headers                                                                                                              |
| **Automated test mapping**        | storefront `bff-path` tests; admin auth-guard specs                                                                                        |
| **Current implementation status** | **Implemented**                                                                                                                            |
| **Known gaps**                    | Direct service access bypasses BFF (header spoof risk)                                                                                     |

---

## UC-BFF-02 — Storefront auth facade

| Field                             | Content                                                          |
| --------------------------------- | ---------------------------------------------------------------- | -------- | ------ | --------------- | -------------- | ------------------------------------------------------------------- |
| **Use case ID**                   | UC-BFF-02                                                        |
| **Name**                          | Facade auth storefront / Storefront auth API                     |
| **Actor**                         | A01, A02                                                         |
| **Supporting actors/services**    | identity-service                                                 |
| **Preconditions**                 | Identity URL configured                                          |
| **Trigger**                       | Login/register/logout/OTP/password flows                         |
| **Input**                         | Auth forms                                                       |
| **Main flow**                     | `POST /api/auth/login                                            | register | logout | forgot-password | reset-password | verify-email`; `GET /api/auth/session`→ sets/clears`SESSION_COOKIE` |
| **Alternate flows**               | —                                                                |
| **Error flows**                   | Upstream identity errors mapped to envelope                      |
| **Authorization**                 | Public auth posts; session get for current cookie                |
| **Database changes**              | Via identity                                                     |
| **Events produced**               | None at BFF                                                      |
| **Events consumed**               | None                                                             |
| **API endpoints**                 | `/api/auth/*` (storefront)                                       |
| **Response contract**             | Session/user DTOs                                                |
| **Idempotency rule**              | N/A                                                              |
| **Postconditions**                | Cookie session established or cleared                            |
| **Automated test mapping**        | storefront auth-related specs if present; identity service specs |
| **Current implementation status** | **Implemented**                                                  |
| **Known gaps**                    | Google OAuth button disabled; no OAuth BFF routes                |

---

## UC-BFF-03 — Admin auth facade

| Field                             | Content                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-BFF-03                                                                                                                     |
| **Name**                          | Facade auth admin / Admin auth API                                                                                            |
| **Actor**                         | A03–A06                                                                                                                       |
| **Supporting actors/services**    | identity-service                                                                                                              |
| **Preconditions**                 | Staff+ roles on user                                                                                                          |
| **Trigger**                       | Admin login/logout                                                                                                            |
| **Input**                         | Credentials                                                                                                                   |
| **Main flow**                     | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` with `ADMIN_SESSION_COOKIE` + `canAccessAdminPortal` |
| **Alternate flows**               | Non-staff denied                                                                                                              |
| **Error flows**                   | 403 portal                                                                                                                    |
| **Authorization**                 | Staff+                                                                                                                        |
| **Database changes**              | Via identity                                                                                                                  |
| **Events produced**               | None                                                                                                                          |
| **Events consumed**               | None                                                                                                                          |
| **API endpoints**                 | admin-web `/api/auth/*`                                                                                                       |
| **Response contract**             | Admin session DTO                                                                                                             |
| **Idempotency rule**              | N/A                                                                                                                           |
| **Postconditions**                | Admin cookie set                                                                                                              |
| **Automated test mapping**        | `auth-guard.spec.ts`                                                                                                          |
| **Current implementation status** | **Implemented**                                                                                                               |
| **Known gaps**                    | —                                                                                                                             |

---

## UC-BFF-04 — Service proxy routing (storefront)

| Field                             | Content                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-BFF-04                                                                                                                                                                                        |
| **Name**                          | Proxy BFF storefront / Storefront service proxy                                                                                                                                                  |
| **Actor**                         | A01, A02                                                                                                                                                                                         |
| **Supporting actors/services**    | All customer-facing microservices                                                                                                                                                                |
| **Preconditions**                 | `SERVICE_ENV_MAP` entry + env URL                                                                                                                                                                |
| **Trigger**                       | Client `fetch('/api/bff/...')`                                                                                                                                                                   |
| **Input**                         | Path after service key                                                                                                                                                                           |
| **Main flow**                     | Map service key → `*_SERVICE_URL` → forward method/body/query to `/api/v1/{path}`                                                                                                                |
| **Alternate flows**               | Shipping helpers for `/shipments/order/:id` and `/shipping/tracking/:code`                                                                                                                       |
| **Error flows**                   | Unknown service → `BFF_UNKNOWN_SERVICE`; missing URL fail-fast (target state)                                                                                                                    |
| **Authorization**                 | Injected session headers                                                                                                                                                                         |
| **Database changes**              | None                                                                                                                                                                                             |
| **Events produced**               | None                                                                                                                                                                                             |
| **Events consumed**               | None                                                                                                                                                                                             |
| **API endpoints**                 | Dedicated: `identity`, `customer`, `catalog`, `media`, `inventory`, `cart`, `order`, `payment`, `shipping`, `review`, `warranty`, `support`, `notification`, **`reporting` (route file exists)** |
| **Response contract**             | Upstream or BFF error envelope                                                                                                                                                                   |
| **Idempotency rule**              | Pass-through                                                                                                                                                                                     |
| **Postconditions**                | Client receives upstream result                                                                                                                                                                  |
| **Automated test mapping**        | storefront bff-path unit tests                                                                                                                                                                   |
| **Current implementation status** | **Partial**                                                                                                                                                                                      |
| **Known gaps**                    | `reporting` route exists but **not** in `SERVICE_ENV_MAP` → `BFF_UNKNOWN_SERVICE`; InMemory clients historically when URL missing (being fail-fasted)                                            |

---

## UC-BFF-05 — Service proxy routing (admin)

| Field                             | Content                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-BFF-05                                                                                                                                                                   |
| **Name**                          | Proxy BFF admin / Admin service proxy                                                                                                                                       |
| **Actor**                         | A03–A06                                                                                                                                                                     |
| **Supporting actors/services**    | Admin-facing services                                                                                                                                                       |
| **Preconditions**                 | Admin session; service in `AdminServiceKey`                                                                                                                                 |
| **Trigger**                       | Admin pages fetch BFF                                                                                                                                                       |
| **Input**                         | Path segments                                                                                                                                                               |
| **Main flow**                     | Dedicated routes + catch-all `/api/bff/[service]/[...path]` limited to known keys                                                                                           |
| **Alternate flows**               | —                                                                                                                                                                           |
| **Error flows**                   | Unknown service key                                                                                                                                                         |
| **Authorization**                 | Session required for header injection; page RBAC separate                                                                                                                   |
| **Database changes**              | None                                                                                                                                                                        |
| **Events produced**               | None                                                                                                                                                                        |
| **Events consumed**               | None                                                                                                                                                                        |
| **API endpoints**                 | Dedicated: identity, customer, catalog, inventory, order, payment, shipping, review, warranty, support, notification, reporting, media, **cart (route exists)** + catch-all |
| **Response contract**             | Upstream / BFF errors                                                                                                                                                       |
| **Idempotency rule**              | Pass-through                                                                                                                                                                |
| **Postconditions**                | Admin UI data loaded                                                                                                                                                        |
| **Automated test mapping**        | admin specs / manual RC                                                                                                                                                     |
| **Current implementation status** | **Partial**                                                                                                                                                                 |
| **Known gaps**                    | Dedicated `cart` BFF route **not** in `AdminServiceKey` → fails same unknown-service check                                                                                  |

---

## UC-BFF-06 — Upstream resilience & error mapping

| Field                             | Content                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-BFF-06                                                                              |
| **Name**                          | Ánh xạ lỗi upstream / Upstream error mapping                                           |
| **Actor**                         | A01–A06                                                                                |
| **Supporting actors/services**    | All proxied services                                                                   |
| **Preconditions**                 | Proxy invoked                                                                          |
| **Trigger**                       | Timeout / 5xx / connection refused                                                     |
| **Input**                         | Upstream failure                                                                       |
| **Main flow**                     | Map to unified envelope with `errorCode`, `message`, `details`, `traceId`, `timestamp` |
| **Alternate flows**               | Pass through upstream 4xx envelope when shape matches                                  |
| **Error flows**                   | `UPSTREAM_UNAVAILABLE`                                                                 |
| **Authorization**                 | N/A                                                                                    |
| **Database changes**              | None                                                                                   |
| **Events produced**               | None                                                                                   |
| **Events consumed**               | None                                                                                   |
| **API endpoints**                 | All BFF proxies                                                                        |
| **Response contract**             | Shared error envelope                                                                  |
| **Idempotency rule**              | N/A                                                                                    |
| **Postconditions**                | Client can show Vietnamese error UX                                                    |
| **Automated test mapping**        | BFF proxy tests where present                                                          |
| **Current implementation status** | **Implemented**                                                                        |
| **Known gaps**                    | Compose must wire `ORDER_SERVICE_URL` etc. or fail-fast (owner rebuild checklist)      |

---

## UC-BFF-07 — Kong gateway (deployment target)

| Field                             | Content                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| **Use case ID**                   | UC-BFF-07                                                          |
| **Name**                          | Kong Gateway OSS / Edge gateway                                    |
| **Actor**                         | External clients / ops                                             |
| **Supporting actors/services**    | Helm/K8s Kong charts in infra docs                                 |
| **Preconditions**                 | Cluster deploy                                                     |
| **Trigger**                       | Production ingress                                                 |
| **Input**                         | HTTP to gateway                                                    |
| **Main flow**                     | Kong routes to services (deployment concern)                       |
| **Alternate flows**               | Local RC uses Next BFF primarily                                   |
| **Error flows**                   | Misconfigured routes                                               |
| **Authorization**                 | Gateway plugins (as deployed)                                      |
| **Database changes**              | None                                                               |
| **Events produced**               | None                                                               |
| **Events consumed**               | None                                                               |
| **API endpoints**                 | Per `docs/DEPLOYMENT.md` / Helm — **not** the local Next BFF paths |
| **Response contract**             | Upstream                                                           |
| **Idempotency rule**              | N/A                                                                |
| **Postconditions**                | Edge entry available                                               |
| **Automated test mapping**        | Infra/smoke as available                                           |
| **Current implementation status** | **Partial** (charts/docs exist; app auth path is BFF)              |
| **Known gaps**                    | Do not assume Kong injects `x-user-*` in local RC — BFF does       |

---

## Service key checklist

| Key          | Storefront map          | Admin map               | Notes                                        |
| ------------ | ----------------------- | ----------------------- | -------------------------------------------- |
| identity     | Yes                     | Yes                     |                                              |
| customer     | Yes                     | Yes                     |                                              |
| catalog      | Yes                     | Yes                     |                                              |
| media        | Yes                     | Yes                     |                                              |
| inventory    | Yes                     | Yes                     |                                              |
| cart         | Yes                     | **Route yes / key Gap** | AdminServiceKey missing cart                 |
| order        | Yes                     | Yes                     |                                              |
| payment      | Yes                     | Yes                     |                                              |
| shipping     | Yes                     | Yes                     | path helpers for tracking                    |
| review       | Yes                     | Yes                     |                                              |
| warranty     | Yes                     | Yes                     |                                              |
| support      | Yes                     | Yes                     |                                              |
| notification | Yes                     | Yes                     |                                              |
| reporting    | **Route yes / map Gap** | Yes                     | Storefront SERVICE_ENV_MAP missing reporting |

---

## Domain summary

| Status                        | Notes                                      |
| ----------------------------- | ------------------------------------------ |
| Session header injection      | Implemented                                |
| Auth facades                  | Implemented (no Google OAuth)              |
| Proxy coverage                | Partial (reporting storefront, cart admin) |
| Fail-fast missing SERVICE_URL | In progress / Partial                      |
| Kong as sole auth             | Not how local apps work                    |
