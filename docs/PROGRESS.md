# NexaTech Progress

## Trạng thái hiện tại

- **Milestone đang làm:** _(sẵn sàng M17 — chưa bắt đầu)_
- **Milestone đã hoàn thành gần nhất:** M16 (Docker/Kong/E2E/seed/Prisma identity-customer)
- **Cập nhật lần cuối:** 2026-07-30
- **Branch:** `main`
- **Kiểm tra DoD M16:** format / lint / test / build / Playwright E2E OK

## Roadmap milestone

| ID      | Milestone                                 | Trạng thái | Ghi chú                          |
| ------- | ----------------------------------------- | ---------- | -------------------------------- |
| M0      | Kiểm tra môi trường và thiết kế kiến trúc | ✅ Done    | Docs + env check                 |
| M1      | Khởi tạo Nx monorepo                      | ✅ Done    | Nx **22.7.7** + TS strict + Jest |
| M2      | Shared libraries và chuẩn nền tảng        | ✅ Done    | 7 shared libs                    |
| M3      | Identity và customer                      | ✅ Done    | Auth flows + customer profile    |
| M4      | Catalog, search và media                  | ✅ Done    | Prisma + FTS + MinIO             |
| M5      | Inventory                                 | ✅ Done    | warehouse/store/stock + RabbitMQ |
| M6      | Cart                                      | ✅ Done    | guest/user merge + Redis         |
| M7      | Order / Checkout                          | ✅ Done    | order-service + outbox           |
| M8      | Payment                                   | ✅ Done    | payment-service + VNPay/MOCK/COD |
| M9      | Shipping                                  | ✅ Done    | shipping-service + mock/GHN      |
| M10     | Review                                    | ✅ Done    | review-service                   |
| M11     | Warranty                                  | ✅ Done    | warranty-service                 |
| M12     | Support                                   | ✅ Done    | support-service                  |
| M13     | Notification                              | ✅ Done    | notification-service             |
| M14     | Reporting                                 | ✅ Done    | reporting-service                |
| M15     | Frontend storefront + admin               | ✅ Done    | Next.js 15 App Router            |
| M16     | Docker/Kong/E2E/seed                      | ✅ Done    | ADR-035                          |
| M17–M22 | …                                         | ⏳ Pending | Sau DoD M16                      |

## Commits

| Commit      | Nội dung                 |
| ----------- | ------------------------ |
| `8526147`   | M4 catalog + media       |
| `b38b723`   | M5 inventory-service     |
| `d2155fc`   | M6 cart-service          |
| `4e2627a`   | M7 order-service         |
| `1245aff`   | M8 payment-service       |
| `882320f`   | M9 shipping-service      |
| `7c203c6`   | M9 docs hash             |
| `631cd88`   | M10 review-service       |
| `d7d4905`   | M10 docs hash            |
| `a60e754`   | M11 warranty-service     |
| `c5a1627`   | M11 docs hash            |
| `7c1a582`   | M12 support-service      |
| `194cdec`   | M12 docs hash            |
| `b353d67`   | M13 notification-service |
| `5c365a3`   | M13 docs hash            |
| `8f86457`   | M14 reporting-service    |
| `b65e901`   | M14 docs hash            |
| `2105088`   | M15 storefront + admin   |
| `811075a`   | M15 docs hash            |
| `042d846`   | M16 Docker/Kong/E2E      |

## M16 đã hoàn thành

- [x] Dockerfile production từng Nest backend + `docker-compose.apps.yml`
- [x] Kong declarative `/api/v1`/`/api/v2` (`infra/kong/kong.yml`)
- [x] Playwright E2E smoke (11 tests)
- [x] Seed ~100 sản phẩm (`pnpm seed:catalog`)
- [x] Wire Prisma identity/customer + migrations
- [x] BFF hardening (path sanitize, timeout, safe 502)
- [x] ADR-035; docs; `HANDOFF-M17.md`
- [x] format / lint / test / build / e2e
- [x] **Không bắt đầu M17**

## Workaround

Nx **22.7.7**, `NX_SKIP_NATIVE_FILE_CACHE=true`, `NX_DAEMON=false`.
Next.js **15.2.4**.

## Nhật ký

### 2026-07-30 — M16 done

- Docker backends + Kong + Playwright + catalog seed + identity/customer Prisma.
- E2E 11/11; lint/test/build monorepo xanh.
- Commit `042d846`.
- HANDOFF-M17 sẵn sàng; **không bắt đầu M17**.

### 2026-07-30 — M16 start

- HEAD `811075a` (M15 docs); baseline xanh; phạm vi theo HANDOFF-M16.

### 2026-07-30 — M15 done

- Commit `2105088` / docs `811075a`.
