# Storefront Catalog Sync

**Date:** 2026-08-03

## Single source

Admin Catalog categories (active, sorted by `sortOrder`) → Storefront header, footer, homepage featured grid, search filters, sitemap, category page labels.

## Implementation

1. Layout server component calls `loadNavCategories()`.
2. Passes `categories` (+ `categoriesError`) into `SiteHeader` / `SiteFooter`.
3. Homepage uses the same loader result.
4. Search/category pages use `getCategoryTree()` / tree resolution only.

## Sync behavior

| Admin change         | Storefront after refresh             |
| -------------------- | ------------------------------------ |
| New active category  | Appears in nav                       |
| Deactivate category  | Disappears                           |
| Rename / slug change | Matches Admin                        |
| API down             | Empty/error — no old hard-coded list |

## Evidence

HTML scrape of `http://127.0.0.1:3000/` category hrefs matched the five PostgreSQL `Category` rows (read-only).
