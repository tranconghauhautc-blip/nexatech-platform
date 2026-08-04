# 15 — Admin RBAC Use Cases

Roles (`libs/shared/auth`): `Customer` < `Staff` < `Manager` < `Admin` < `SuperAdmin` (ranks 1–5).
Portal entry: `canAccessAdminPortal` = any Staff+.
**Auth model:** BFF injects `x-user-id` / `x-user-roles`; backends do **not** use Nest JwtAuthGuard.
**Canonical UI menu:** `apps/admin-web/src/lib/menu.ts` (not the stale `libs/shared/web` copy).

---

## UC-ADM-01 — Access admin portal

| Field                             | Content                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ADM-01                                                                                 |
| **Name**                          | Đăng nhập cổng admin / Access admin portal                                                |
| **Actor**                         | A03–A06                                                                                   |
| **Supporting actors/services**    | identity login; admin-web `POST /api/auth/login`, `GET /api/auth/session`                 |
| **Preconditions**                 | User has Staff+ role                                                                      |
| **Trigger**                       | Admin login                                                                               |
| **Input**                         | Email/password                                                                            |
| **Main flow**                     | Login → session cookie → `canAccessAdminPortal` check → menu filtered by `hasMinimumRole` |
| **Alternate flows**               | Customer credentials → denied portal                                                      |
| **Error flows**                   | Bad credentials                                                                           |
| **Authorization**                 | Staff+                                                                                    |
| **Database changes**              | Identity session                                                                          |
| **Events produced**               | None                                                                                      |
| **Events consumed**               | None                                                                                      |
| **API endpoints**                 | `POST /api/auth/login`, `GET /api/auth/session`, identity `POST /api/v1/auth/login`       |
| **Response contract**             | Session DTO                                                                               |
| **Idempotency rule**              | N/A                                                                                       |
| **Postconditions**                | Admin cookie set                                                                          |
| **Automated test mapping**        | `apps/admin-web/specs/auth-guard.spec.ts`, `menu.spec.ts`                                 |
| **Current implementation status** | **Implemented**                                                                           |
| **Known gaps**                    | —                                                                                         |

---

## UC-ADM-02 — Menu & route gating

| Field                             | Content                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| **Use case ID**                   | UC-ADM-02                                                         |
| **Name**                          | Phân quyền menu / Menu & path RBAC                                |
| **Actor**                         | A03–A06                                                           |
| **Supporting actors/services**    | admin-web middleware / `decideAdminAccess`                        |
| **Preconditions**                 | Logged-in staff                                                   |
| **Trigger**                       | Navigate sidebar                                                  |
| **Input**                         | Path + roles                                                      |
| **Main flow**                     | Filter `ADMIN_MENU_ITEMS`; block path if below `minimumRole`      |
| **Alternate flows**               | —                                                                 |
| **Error flows**                   | Redirect/deny                                                     |
| **Authorization**                 | UI `hasMinimumRole`                                               |
| **Database changes**              | None                                                              |
| **Events produced**               | None                                                              |
| **Events consumed**               | None                                                              |
| **API endpoints**                 | N/A (UI)                                                          |
| **Response contract**             | N/A                                                               |
| **Idempotency rule**              | N/A                                                               |
| **Postconditions**                | Only allowed pages visible                                        |
| **Automated test mapping**        | `menu.spec.ts`, `auth-guard.spec.ts`                              |
| **Current implementation status** | **Implemented**                                                   |
| **Known gaps**                    | UI often stricter than backend Staff+ APIs; shared-web menu stale |

---

## UC-ADM-03 — Backend Staff+ enforcement

| Field                             | Content                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ADM-03                                                                                                     |
| **Name**                          | Guard backend admin API / Backend Staff gate                                                                  |
| **Actor**                         | A03–A06 (or forged headers if BFF bypassed)                                                                   |
| **Supporting actors/services**    | Each microservice admin controller                                                                            |
| **Preconditions**                 | Headers present                                                                                               |
| **Trigger**                       | Any admin mutation/read                                                                                       |
| **Input**                         | `x-user-roles`                                                                                                |
| **Main flow**                     | `requireStaff` / `hasMinimumRole(Staff)` / Admin-only for special ops                                         |
| **Alternate flows**               | SuperAdmin intended for users — lab disabled                                                                  |
| **Error flows**                   | FORBIDDEN                                                                                                     |
| **Authorization**                 | See matrix below                                                                                              |
| **Database changes**              | Per resource                                                                                                  |
| **Events produced**               | Per resource                                                                                                  |
| **Events consumed**               | None                                                                                                          |
| **API endpoints**                 | All `/admin/*` and sync Staff endpoints                                                                       |
| **Response contract**             | Error envelope on deny                                                                                        |
| **Idempotency rule**              | Per endpoint                                                                                                  |
| **Postconditions**                | Unauthorized calls rejected (when enforcement active)                                                         |
| **Automated test mapping**        | Per-service controller/service specs; `libs/shared/auth` specs                                                |
| **Current implementation status** | **Partial**                                                                                                   |
| **Known gaps**                    | identity admin users BFLA lab always-allow; payment COD collect lacks local requireStaff; trust BFF perimeter |

---

## Permission matrix

> **Legend:** Allow/Deny = intended effective access via admin-web + backend.
> Backend column names the real check. Tests are representative paths.

| Resource                                     | Action                             | Actor                  | Allow/Deny              | Endpoint                                       | Backend guard                           | Test                        |
| -------------------------------------------- | ---------------------------------- | ---------------------- | ----------------------- | ---------------------------------------------- | --------------------------------------- | --------------------------- |
| Admin portal                                 | Login/session                      | Customer               | Deny                    | `POST/GET /api/auth/*` (admin-web)             | `canAccessAdminPortal` Staff+           | `auth-guard.spec.ts`        |
| Admin portal                                 | Login/session                      | Staff+                 | Allow                   | same                                           | Staff+                                  | `auth-guard.spec.ts`        |
| Dashboard menu                               | View                               | Staff+                 | Allow                   | UI `/bang-dieu-khien`                          | UI `minimumRole=Staff`                  | `menu.spec.ts`              |
| Products/Categories/Brands/Specs/Media menus | View                               | Staff                  | Deny (UI)               | UI Manager routes                              | UI `Manager`                            | `menu.spec.ts`              |
| Products/Categories/Brands/Specs/Media menus | View                               | Manager+               | Allow                   | UI                                             | UI `Manager`                            | `menu.spec.ts`              |
| Catalog admin API                            | Create/update product/SKU/price    | Staff+                 | Allow                   | `/api/v1/admin/catalog/*`                      | `hasMinimumRole(Staff)`                 | `catalog.service.spec.ts`   |
| Catalog admin API                            | Create/update                      | Customer               | Deny                    | same                                           | Staff check                             | catalog specs               |
| Inventory stock mutate                       | Receive/issue/reserve/...          | Staff+                 | Allow                   | `/api/v1/admin/inventory/*`                    | `requireStaff`                          | `inventory.service.spec.ts` |
| Inventory stock mutate                       | Any                                | Customer               | Deny                    | same                                           | Staff                                   | inventory specs             |
| Warehouses UI mutate                         | Save                               | Staff+                 | Allow                   | admin `/kho-hang`                              | UI Staff + API Staff                    | page role checks            |
| Stores UI mutate                             | Save                               | Staff                  | Deny (UI)               | admin `/cua-hang-kho`                          | UI Manager mutate                       | page role checks            |
| Stores UI mutate                             | Save                               | Manager+               | Allow                   | same                                           | UI Manager + API Staff                  | page role checks            |
| Orders admin                                 | List/get/transition/cancel/confirm | Staff+                 | Allow                   | `/api/v1/admin/orders/*`                       | Staff (`requireStaff`)                  | `order.service.spec.ts`     |
| Orders reconcile                             | Reconcile fulfillment              | Staff/Manager          | Deny                    | `POST .../reconcile-fulfillment`               | `requireAdmin`                          | `order.service.spec.ts`     |
| Orders reconcile                             | Reconcile fulfillment              | Admin+                 | Allow                   | same                                           | Admin                                   | `order.service.spec.ts`     |
| Orders shipping-sync                         | Sync from shipping                 | Customer               | Deny                    | `POST /api/v1/orders/:id/shipping-sync`        | `requireStaff`                          | order + shipping P0 specs   |
| Orders shipping-sync                         | Sync                               | Staff service identity | Allow                   | same                                           | Staff                                   | `shipping.service.spec.ts`  |
| Orders payment-sync                          | Sync                               | Customer               | Deny                    | `POST /api/v1/orders/:id/payment-sync`         | `requireStaff`                          | order specs                 |
| Payments admin                               | List/get                           | Staff+                 | Allow                   | `/api/v1/admin/payments`                       | Staff on list/get                       | payment specs               |
| Payments COD collect                         | Collect                            | Any header (gap)       | **Partial**             | `POST .../cod-collect`                         | **No local requireStaff**               | gap — rely on BFF           |
| Shipments admin                              | List/transition                    | Staff+                 | Allow                   | `/api/v1/admin/shipments/*`                    | Staff                                   | shipping specs              |
| Shipments ready-for-pickup                   | Issue code                         | Staff+                 | Allow                   | `POST /shipments/:id/ready-for-pickup`         | Staff                                   | shipping specs              |
| Shipments confirm-pickup                     | Confirm                            | Customer owner         | Allow                   | `POST .../confirm-pickup`                      | Owner                                   | shipping specs              |
| Reviews admin                                | Moderate/reports/rebuild           | Staff+                 | Allow                   | `/api/v1/admin/reviews*`                       | `requireStaff`                          | review specs                |
| Warranty/Returns admin                       | Transition                         | Staff+                 | Allow                   | `/api/v1/admin/warranty/*`, `/admin/returns/*` | `requireStaff`                          | warranty specs              |
| Support admin                                | Assign/transition/priority         | Staff+                 | Allow                   | `/api/v1/admin/support/*`                      | `requireStaff`                          | support specs               |
| Notifications menu                           | View                               | Staff                  | Deny (UI)               | UI `/thong-bao`                                | UI Manager                              | `menu.spec.ts`              |
| Notifications request API                    | Request send                       | Staff+                 | Allow                   | `POST /notifications/request`                  | `requireStaff`                          | notification specs          |
| Notifications email deliveries               | List                               | Staff+                 | Allow                   | `GET /admin/notifications/email-deliveries`    | `requireStaff`                          | notification specs          |
| Reporting menu                               | View                               | Staff                  | Deny (UI)               | UI `/bao-cao`                                  | UI Manager                              | `menu.spec.ts`              |
| Reporting APIs                               | Dashboard/lists/audit              | Staff+                 | Allow                   | `/api/v1/admin/reporting/*`                    | `requireStaff`                          | reporting specs             |
| Audit menu                                   | View                               | Manager                | Deny (UI)               | UI `/nhat-ky`                                  | UI Admin                                | `menu.spec.ts`              |
| Audit menu                                   | View                               | Admin+                 | Allow                   | UI                                             | UI Admin                                | `menu.spec.ts`              |
| Users menu                                   | View                               | Admin                  | Deny (UI)               | UI `/nguoi-dung`                               | UI SuperAdmin                           | `menu.spec.ts`              |
| Users admin API                              | CRUD/disable/export                | SuperAdmin intended    | **Partial Allow (lab)** | `/api/v1/admin/users/*`                        | `enforceAdminFunction` **always allow** | gap — no hard deny test     |
| Media orphan cleanup                         | Cleanup                            | Staff                  | Deny                    | `POST /media/admin/cleanup-orphans`            | Manager+                                | media specs                 |
| Media orphan cleanup                         | Cleanup                            | Manager+               | Allow                   | same                                           | Manager+                                | media specs                 |
| Media link                                   | Link entity                        | Staff+                 | Allow                   | `POST /media/:id/links`                        | Staff                                   | media specs                 |

---

## UI minimum roles (canonical)

| Min role   | Routes                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Staff      | `/bang-dieu-khien`, `/kho-hang`, `/cua-hang-kho`, `/don-hang`, `/thanh-toan`, `/van-chuyen`, `/danh-gia`, `/bao-hanh`, `/ho-tro` |
| Manager    | `/san-pham`, `/danh-muc`, `/thuong-hieu`, `/thong-so`, `/media`, `/thong-bao`, `/bao-cao`                                        |
| Admin      | `/nhat-ky`                                                                                                                       |
| SuperAdmin | `/nguoi-dung`                                                                                                                    |

---

## Domain Known gaps

| Gap                  | Detail                                                          |
| -------------------- | --------------------------------------------------------------- |
| UI vs API            | Many Manager/Admin UI gates while APIs only Staff+              |
| SuperAdmin users API | Lab BFLA disables enforcement                                   |
| COD collect          | Missing local Staff check                                       |
| Shared menu lib      | `libs/shared/web` admin-menu stale vs admin-web                 |
| Header trust         | Compromised direct service call can spoof roles without gateway |
