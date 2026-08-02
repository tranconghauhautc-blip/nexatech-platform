# CUSTOMER ACCOUNT & CHECKOUT AUDIT

> 2026-08-02 — verified from source + root-cause analysis. **No commit.**

## Payment history 404

| Layer      | Finding                                               |
| ---------- | ----------------------------------------------------- |
| Storefront | Was calling `GET /api/bff/payment/payments`           |
| Backend    | No collection list; only POST, by-order, :id          |
| Fix        | `GET /api/v1/payments/me` + storefront `/payments/me` |
| Empty      | Returns `[]` (200)                                    |

## Checkout

| Item                  | Status                                         |
| --------------------- | ---------------------------------------------- |
| Saved address picker  | Fixed (default selected)                       |
| Pickup store selector | Fixed (searchable store cards; no raw storeId) |
| Field name            | Was `storeId` → now `pickupStoreId` (contract) |
| Double-submit         | Button disabled while submitting               |
| Cart clear            | `refresh()` after success + result page        |
| VNPay                 | Placeholder note when no sandbox credentials   |

## Orders

| Item                         | Status |
| ---------------------------- | ------ |
| List `orderCode`             | Fixed  |
| Detail items/address/payment | Fixed  |
| Pickup vs shipment messaging | Fixed  |

## Wishlist / Reviews / Warranty / Support

| Item                    | Status                        |
| ----------------------- | ----------------------------- |
| Wishlist hydration      | `/products/summaries?ids=`    |
| Reviews empty           | `GET /reviews/me` + empty CTA |
| Warranty/Support create | Forms + CTAs                  |

## Address

| Item      | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Dataset   | 34 provinces, 3321 wards (HN/HCM/DN covered)                          |
| Source    | `data/vietnam-administrative` + `libs/shared/address/src/data`        |
| Selector  | `VietnamAddressSelector` on `/tai-khoan/ho-so`                        |
| Migration | Non-destructive `provinceCode`/`wardCode` (SQL ready; deploy pending) |
| Validate  | `pnpm address-data:validate` PASS                                     |

## Runtime images

Rebuilt + recreated (compose, no `-v`): payment/catalog/review/customer/storefront/admin `:0.17.0` — healthy. Apply customer migrate deploy before relying on new address columns in DB.
