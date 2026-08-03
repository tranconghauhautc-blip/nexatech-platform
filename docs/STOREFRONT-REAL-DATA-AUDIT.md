# Storefront Real Data Audit

**Date:** 2026-08-03

## Removed hard-coded category nav

Deleted runtime `NAV_CATEGORIES` usage from:

- `site-header.tsx` / `site-footer.tsx`
- `app/page.tsx` featured categories
- `app/tim-kiem/page.tsx` (no hard-coded fallback)
- `app/danh-muc/[slug]/page.tsx`
- `app/sitemap.ts`

Shared loader: `apps/storefront-web/src/lib/categories.ts` → `loadNavCategories()` from catalog `GET /categories`.

On API failure: empty list + honest error UI — **no** fallback to old sample categories.

## Runtime evidence

After Docker recreate of `storefront-web:0.17.0`, homepage/header/footer show Admin categories only:

Điện thoại, Máy tính bảng, Laptop, Màn hình, Tai nghe.

## Other real-data surfaces

| Surface                        | Source                          |
| ------------------------------ | ------------------------------- |
| Product grid / PDP             | catalog-service                 |
| Price                          | catalog SKU price               |
| Stock badge / add-to-cart      | inventory availability          |
| Account overview counts        | parallel BFF fetches (real 0/—) |
| Wishlist/compare/recent (auth) | cart-service                    |
| Profile/addresses              | customer-service                |

## Remaining risks

- Stock empty → PDP shows out of stock until Admin receive
- Spec `storage_gb` not yet in DB (only `ram_gb`) — owner edit via Admin Thông số
- Product spec values for Nova X1 not yet set via Admin product edit
