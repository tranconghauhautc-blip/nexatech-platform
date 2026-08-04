# 01 — Identity Use Cases

Service: `identity-service` · Prefixes: `/api/v1/auth/*`, `/api/v1/admin/users/*`
Auth: public OTP/JWT flows; admin routes read `x-user-id` / `x-user-roles`. **No Nest JwtAuthGuard.**

---

## UC-ID-01 — Register with email

| Field                             | Content                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ID-01                                                                                                                                           |
| **Name**                          | Đăng ký tài khoản bằng email / Register with email                                                                                                 |
| **Actor**                         | A01 Guest                                                                                                                                          |
| **Supporting actors/services**    | identity-service (Postgres: User, OtpChallenge); storefront `POST /api/auth/register`                                                              |
| **Preconditions**                 | Email chưa tồn tại; password đủ policy Zod                                                                                                         |
| **Trigger**                       | Guest submit form đăng ký                                                                                                                          |
| **Input**                         | `{ email, password, fullName?, roles? }` — `roles` accepted for SC-87 mass-assignment lab                                                          |
| **Main flow**                     | 1) Validate body 2) bcrypt hash 3) create User `PENDING_VERIFICATION` 4) create OTP `email_verify` 5) return user + optional `debugOtp` (non-prod) |
| **Alternate flows**               | Re-register existing unverified email may re-issue OTP depending on service rules                                                                  |
| **Error flows**                   | Duplicate email; validation failure → error envelope                                                                                               |
| **Authorization**                 | Public                                                                                                                                             |
| **Database changes**              | `User`, `OtpChallenge`                                                                                                                             |
| **Events produced**               | **None** (contract `user.registered` not emitted)                                                                                                  |
| **Events consumed**               | None                                                                                                                                               |
| **API endpoints**                 | `POST /api/v1/auth/register` · BFF `POST /api/auth/register`                                                                                       |
| **Response contract**             | Register response DTO + optional `debugOtp`; errors `{errorCode,message,details,traceId,timestamp}`                                                |
| **Idempotency rule**              | None                                                                                                                                               |
| **Postconditions**                | User pending verification; OTP outstanding                                                                                                         |
| **Automated test mapping**        | `apps/identity-service/src/app/auth/auth.service.spec.ts` (register → verify → login)                                                              |
| **Current implementation status** | **Implemented**                                                                                                                                    |
| **Known gaps**                    | No RabbitMQ `user.registered`; no auto customer-profile create; OTP not emailed via notification-service                                           |

---

## UC-ID-02 — Verify email

| Field                             | Content                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-ID-02                                                                             |
| **Name**                          | Xác minh email / Verify email                                                        |
| **Actor**                         | A01 Guest / A02 Customer (pre-active)                                                |
| **Supporting actors/services**    | identity-service                                                                     |
| **Preconditions**                 | OTP `email_verify` còn hiệu lực                                                      |
| **Trigger**                       | Submit mã OTP                                                                        |
| **Input**                         | `{ email, code }`                                                                    |
| **Main flow**                     | Consume OTP → set `ACTIVE`, `emailVerifiedAt`                                        |
| **Alternate flows**               | —                                                                                    |
| **Error flows**                   | Invalid/expired OTP                                                                  |
| **Authorization**                 | Public                                                                               |
| **Database changes**              | `User` status; OTP consumed                                                          |
| **Events produced**               | **None** (`user.email_verified` contract unused)                                     |
| **Events consumed**               | None                                                                                 |
| **API endpoints**                 | `POST /api/v1/auth/verify-email` · BFF `POST /api/auth/verify-email`                 |
| **Response contract**             | Success ack / error envelope                                                         |
| **Idempotency rule**              | None                                                                                 |
| **Postconditions**                | User ACTIVE                                                                          |
| **Automated test mapping**        | `auth.service.spec.ts`                                                               |
| **Current implementation status** | **Implemented**                                                                      |
| **Known gaps**                    | Notification consumer listens for `user.email_verified` but identity never publishes |

---

## UC-ID-03 — Login

| Field                             | Content                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ID-03                                                                                                                           |
| **Name**                          | Đăng nhập / Login                                                                                                                  |
| **Actor**                         | A02 Customer (or staff logging into storefront/admin)                                                                              |
| **Supporting actors/services**    | identity-service; storefront/admin session cookie writers                                                                          |
| **Preconditions**                 | User ACTIVE (or login rules allow); credentials valid                                                                              |
| **Trigger**                       | Submit email/password                                                                                                              |
| **Input**                         | `{ email, password, deviceInfo? }`                                                                                                 |
| **Main flow**                     | Rate-limit → bcrypt compare → issue access JWT + refresh JWT → persist `Session` (+ optional `Device`) → BFF stores session cookie |
| **Alternate flows**               | Admin portal login additionally requires `canAccessAdminPortal` (Staff+)                                                           |
| **Error flows**                   | Bad credentials; rate limit; inactive user                                                                                         |
| **Authorization**                 | Public                                                                                                                             |
| **Database changes**              | `Session`, optional `Device`                                                                                                       |
| **Events produced**               | None                                                                                                                               |
| **Events consumed**               | None                                                                                                                               |
| **API endpoints**                 | `POST /api/v1/auth/login` · storefront/admin `POST /api/auth/login`                                                                |
| **Response contract**             | Tokens + user summary                                                                                                              |
| **Idempotency rule**              | None                                                                                                                               |
| **Postconditions**                | Session active; BFF can inject `x-user-id` / `x-user-roles`                                                                        |
| **Automated test mapping**        | `auth.service.spec.ts`                                                                                                             |
| **Current implementation status** | **Implemented**                                                                                                                    |
| **Known gaps**                    | Sessions in **Postgres**, not Redis (product intent mentioned Redis sessions)                                                      |

---

## UC-ID-04 — Refresh token

| Field                             | Content                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| **Use case ID**                   | UC-ID-04                                                       |
| **Name**                          | Làm mới access token / Refresh                                 |
| **Actor**                         | A02–A06                                                        |
| **Supporting actors/services**    | identity-service                                               |
| **Preconditions**                 | Valid refresh JWT (`typ=refresh`, `sid`) + session not revoked |
| **Trigger**                       | Client refresh                                                 |
| **Input**                         | `{ refreshToken }`                                             |
| **Main flow**                     | Verify → revoke old session → rotate tokens                    |
| **Alternate flows**               | —                                                              |
| **Error flows**                   | Invalid/expired refresh; revoked session                       |
| **Authorization**                 | Bearer refresh token                                           |
| **Database changes**              | Session revoke + new Session                                   |
| **Events produced**               | None                                                           |
| **Events consumed**               | None                                                           |
| **API endpoints**                 | `POST /api/v1/auth/refresh`                                    |
| **Response contract**             | New access + refresh tokens                                    |
| **Idempotency rule**              | None (rotation)                                                |
| **Postconditions**                | Previous refresh invalidated                                   |
| **Automated test mapping**        | `auth.service.spec.ts`                                         |
| **Current implementation status** | **Implemented**                                                |
| **Known gaps**                    | —                                                              |

---

## UC-ID-05 — Logout

| Field                             | Content                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ID-05                                                                                       |
| **Name**                          | Đăng xuất / Logout                                                                             |
| **Actor**                         | A02–A06                                                                                        |
| **Supporting actors/services**    | identity-service; BFF clear cookie                                                             |
| **Preconditions**                 | Session exists                                                                                 |
| **Trigger**                       | Logout action                                                                                  |
| **Input**                         | `{ sessionId }`                                                                                |
| **Main flow**                     | Revoke session; clear app cookie                                                               |
| **Alternate flows**               | —                                                                                              |
| **Error flows**                   | Unknown session                                                                                |
| **Authorization**                 | Public body sessionId (ownership checks intentionally weak for SC lab on related session APIs) |
| **Database changes**              | Session revoked                                                                                |
| **Events produced**               | None                                                                                           |
| **Events consumed**               | None                                                                                           |
| **API endpoints**                 | `POST /api/v1/auth/logout` · `POST /api/auth/logout`                                           |
| **Response contract**             | Ack                                                                                            |
| **Idempotency rule**              | None                                                                                           |
| **Postconditions**                | Session unusable                                                                               |
| **Automated test mapping**        | `auth.service.spec.ts`                                                                         |
| **Current implementation status** | **Implemented**                                                                                |
| **Known gaps**                    | —                                                                                              |

---

## UC-ID-06 — Forgot / reset password

| Field                             | Content                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-ID-06                                                                                         |
| **Name**                          | Quên / đặt lại mật khẩu / Forgot & reset password                                                |
| **Actor**                         | A01 / A02                                                                                        |
| **Supporting actors/services**    | identity-service                                                                                 |
| **Preconditions**                 | Account exists for forgot (response may be generic)                                              |
| **Trigger**                       | Forgot form → reset form                                                                         |
| **Input**                         | Forgot: `{ email }` · Reset: `{ email, code, newPassword }`                                      |
| **Main flow**                     | Issue reset OTP → verify → update password hash → revoke all sessions                            |
| **Alternate flows**               | —                                                                                                |
| **Error flows**                   | Bad OTP; weak password                                                                           |
| **Authorization**                 | Public                                                                                           |
| **Database changes**              | `OtpChallenge`, `User.passwordHash`, all Sessions revoked                                        |
| **Events produced**               | **None** (`user.password_reset_requested` unused)                                                |
| **Events consumed**               | None                                                                                             |
| **API endpoints**                 | `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password` · matching `/api/auth/*` |
| **Response contract**             | Ack / tokens cleared                                                                             |
| **Idempotency rule**              | None                                                                                             |
| **Postconditions**                | New password; sessions invalidated                                                               |
| **Automated test mapping**        | `auth.service.spec.ts`                                                                           |
| **Current implementation status** | **Implemented**                                                                                  |
| **Known gaps**                    | No email publish to notification-service                                                         |

---

## UC-ID-07 — Get current user (me)

| Field                             | Content                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| **Use case ID**                   | UC-ID-07                                                    |
| **Name**                          | Lấy hồ sơ auth / Get me                                     |
| **Actor**                         | A02–A06                                                     |
| **Supporting actors/services**    | identity-service                                            |
| **Preconditions**                 | Valid access JWT                                            |
| **Trigger**                       | Session bootstrap / profile                                 |
| **Input**                         | `Authorization: Bearer` or `?access_token=`                 |
| **Main flow**                     | Manual `jwt.verify` → load user                             |
| **Alternate flows**               | —                                                           |
| **Error flows**                   | Invalid token                                               |
| **Authorization**                 | JWT verified in service (not Nest guard)                    |
| **Database changes**              | None                                                        |
| **Events produced**               | None                                                        |
| **Events consumed**               | None                                                        |
| **API endpoints**                 | `GET /api/v1/auth/me` · BFF session `GET /api/auth/session` |
| **Response contract**             | User DTO                                                    |
| **Idempotency rule**              | N/A                                                         |
| **Postconditions**                | —                                                           |
| **Automated test mapping**        | `auth.service.spec.ts`                                      |
| **Current implementation status** | **Implemented**                                             |
| **Known gaps**                    | —                                                           |

---

## UC-ID-08 — List / revoke sessions

| Field                             | Content                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-ID-08                                                                       |
| **Name**                          | Quản lý phiên đăng nhập / Session list & revoke                                |
| **Actor**                         | A02–A06                                                                        |
| **Supporting actors/services**    | identity-service                                                               |
| **Preconditions**                 | Sessions exist                                                                 |
| **Trigger**                       | Device/session management UI                                                   |
| **Input**                         | Path `userId` / `sessionId`; optional `x-user-id`                              |
| **Main flow**                     | List sessions by userId; DELETE revoke sessionId                               |
| **Alternate flows**               | —                                                                              |
| **Error flows**                   | Not found                                                                      |
| **Authorization**                 | **Partial / lab:** ownership checks intentionally skipped (SC-78/79 IDOR)      |
| **Database changes**              | Session revoke on delete                                                       |
| **Events produced**               | None                                                                           |
| **Events consumed**               | None                                                                           |
| **API endpoints**                 | `GET /api/v1/auth/sessions/:userId`, `DELETE /api/v1/auth/sessions/:sessionId` |
| **Response contract**             | Session list / ack                                                             |
| **Idempotency rule**              | None                                                                           |
| **Postconditions**                | Revoked session invalid                                                        |
| **Automated test mapping**        | `auth.service.spec.ts` (password reset revokes sessions)                       |
| **Current implementation status** | **Partial** (functional but IDOR lab behavior)                                 |
| **Known gaps**                    | Missing strict ownership enforcement for production                            |

---

## UC-ID-09 — Admin user management

| Field                             | Content                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Use case ID**                   | UC-ID-09                                                                                                                       |
| **Name**                          | Quản trị người dùng / Admin users CRUD                                                                                         |
| **Actor**                         | A06 Super Admin (intended)                                                                                                     |
| **Supporting actors/services**    | identity-service; admin-web `/nguoi-dung`                                                                                      |
| **Preconditions**                 | Caller headers present                                                                                                         |
| **Trigger**                       | Admin UI user ops                                                                                                              |
| **Input**                         | Create/patch/disable payloads per contracts                                                                                    |
| **Main flow**                     | List/export/create/get/patch/disable/soft-delete                                                                               |
| **Alternate flows**               | Export CSV-style export endpoint                                                                                               |
| **Error flows**                   | Validation; not found                                                                                                          |
| **Authorization**                 | Calls `enforceAdminFunction({ requiredRoles: [SuperAdmin] })` but helper in security-lab **always returns allow** (SC-08 BFLA) |
| **Database changes**              | `User` rows                                                                                                                    |
| **Events produced**               | None                                                                                                                           |
| **Events consumed**               | None                                                                                                                           |
| **API endpoints**                 | `GET/POST /api/v1/admin/users`, `GET .../export`, `GET/PATCH /:userId`, `POST /:userId/disable`, `DELETE /:userId`             |
| **Response contract**             | User admin DTOs                                                                                                                |
| **Idempotency rule**              | None                                                                                                                           |
| **Postconditions**                | User state updated                                                                                                             |
| **Automated test mapping**        | No dedicated admin-users spec found                                                                                            |
| **Current implementation status** | **Partial**                                                                                                                    |
| **Known gaps**                    | SuperAdmin enforcement lab-disabled; no unit tests for controller                                                              |

---

## UC-ID-10 — Google OAuth login

| Field                             | Content                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Use case ID**                   | UC-ID-10                                                                                                       |
| **Name**                          | Đăng nhập Google OAuth / Google OAuth                                                                          |
| **Actor**                         | A01 / A02                                                                                                      |
| **Supporting actors/services**    | Prisma `OAuthAccount` model; storefront button                                                                 |
| **Preconditions**                 | Product requires Google Client credentials                                                                     |
| **Trigger**                       | Click Google login                                                                                             |
| **Input**                         | OAuth authorization code (intended)                                                                            |
| **Main flow**                     | **Not implemented in production AuthController**                                                               |
| **Alternate flows**               | Lab only: `GET /lab/oauth-callback` (security scenario, not Google)                                            |
| **Error flows**                   | UI disabled                                                                                                    |
| **Authorization**                 | N/A                                                                                                            |
| **Database changes**              | Model exists unused                                                                                            |
| **Events produced**               | None                                                                                                           |
| **Events consumed**               | None                                                                                                           |
| **API endpoints**                 | **None production** under `/auth/*`                                                                            |
| **Response contract**             | N/A                                                                                                            |
| **Idempotency rule**              | N/A                                                                                                            |
| **Postconditions**                | N/A                                                                                                            |
| **Automated test mapping**        | Lab health endpoints only                                                                                      |
| **Current implementation status** | **Gap**                                                                                                        |
| **Known gaps**                    | Storefront button disabled (`NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`); title indicates backend credentials pending |

---

## Domain summary

| Status      | UC                                                      |
| ----------- | ------------------------------------------------------- |
| Implemented | UC-ID-01…07                                             |
| Partial     | UC-ID-08, UC-ID-09                                      |
| Gap         | UC-ID-10; RabbitMQ identity events; Redis session store |
