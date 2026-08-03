# Admin Local RC Acceptance

**Branch:** `fix/media-upload-profile-minimal-reset`  
**Baseline commit:** `92689d5`  
**Date:** 2026-08-03  
**Status:** Implementation ready for owner review (stock init + full order lifecycle not executed in this session to preserve owner-owned credentials and avoid unsolicited mutations).

## Preserved runtime data (read-only SQL)

| Entity         | Evidence                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| Categories (5) | `dien-thoai`, `may-tinh-bang`, `laptop`, `man-hinh`, `tai-nghe` — active, sortOrder 1–5 |
| Brand          | `nexatech` / NexaTech                                                                   |
| Product        | `nexatech-nova-x1-graphite` ACTIVE                                                      |
| SKU            | `NT-PHONE-NX1-BLK` Graphite 256GB                                                       |
| Spec template  | `Thông số điện thoại` with `ram_gb` (number, GB)                                        |
| Media link     | 1 primary thumbnail mediaId present                                                     |
| Warehouse      | `HN-MAIN` Kho trung tâm Hà Nội active                                                   |
| Store          | `HCM-NGUYEN-HUE` pickupEnabled active                                                   |
| Stock          | **empty** (`StockItem` 0 rows) — owner must initialize via Admin UI                     |
| Customers      | 2 profiles present                                                                      |

## Admin light theme

- `apps/admin-web/src/app/globals.css` converted to light tokens (`#F6F8FC` page, white sidebar/card/table, `#E2E8F0` borders, cyan accent).
- Sidebar/Topbar modules updated; no dark `color-scheme`.
- Micro-interactions: button hover/press, drawer/modal fade, table row hover, `prefers-reduced-motion` respected.
- Host `nx build admin-web`: **PASS**.
- Docker image `nexatech/admin-web:0.17.0` rebuilt and recreated.

## Feature readiness (Admin)

| Area                                             | Result                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| Categories/brands CRUD                           | Soft activate/edit present (pre-existing + preserved)                    |
| Spec templates                                   | **GET/PATCH/DELETE** added; Admin row actions + edit drawer              |
| Products                                         | Edit drawer + specs on create/edit via PATCH                             |
| Media                                            | Presign flow preserved; list columns enriched; set primary + unlink APIs |
| Inventory UI                                     | Receive / issue / adjust drawer with idempotency keys                    |
| Users create                                     | `new-password` autocomplete + confirm password                           |
| Audit                                            | Actor email resolution + Vietnamese labels + detail drawer               |
| Payment/shipping/review/warranty/support filters | Human-readable primary search                                            |

## Owner Phase A checklist (manual)

1. Confirm Storefront header shows exactly the five Admin categories (verified via HTML scrape — PASS).
2. Admin → Thông số → open `Thông số điện thoại` → add `storage_gb` / Dung lượng bộ nhớ / number / GB / filterable → save.
3. Admin → Sản phẩm → Nova X1 → set RAM + Storage 256 → save.
4. Admin → Media → confirm thumbnail preview for linked PNG.
5. Admin → Tồn kho → Nhập kho:
   - `NT-PHONE-NX1-BLK` + warehouse `HN-MAIN` qty **10**
   - `NT-PHONE-NX1-BLK` + store `HCM-NGUYEN-HUE` qty **5**
6. Refresh + restart inventory container → stock persists.
7. Storefront PDP Nova X1 → available (not “Tạm hết hàng”).

## Tests run this session

- `nx test admin-web` — 31/31 PASS
- `nx test catalog-service` — PASS
- `nx test customer-service` — 8/8 PASS
- `nx build admin-web` / `storefront-web` host — PASS
- Docker rebuild admin/storefront/catalog/customer/media — PASS
- `pnpm media:audit` — PASSED
- `pnpm test:lab-reset-minimal` — 7/7 PASS

## Not claimed PASS (owner action required)

- Full browser Phase A–D order lifecycle with credentials
- Stock receive through Admin UI (API path ready; DB currently empty)
- Adding `storage_gb` attribute + product spec values
