# Product Image Import Guide

## Goal

Attach real product images to catalog SKUs/slugs via Media + MinIO, then show on Storefront.

## Preconditions

- Media service healthy (`:3004`)
- MinIO healthy (`:9000` / console `:9001`)
- Admin login with Manager+ 
- Catalog products seeded (`pnpm seed:catalog`)

## Mapping convention

Place files in a folder, e.g. `imports/product-images/`:

```
NT-LAP-0098.jpg          → skuCode
laptop-nexatech-samsung-098.png → product slug
```

Rules:

- Filename stem = `skuCode` **or** product `slug`
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`
- Max size: follow media-service limit (see service config)
- One primary thumbnail + optional `*-gallery-1` … suffixes

## Manual flow (Admin)

1. Login Admin → Media / Products
2. Upload image (presign → MinIO)
3. Attach media id to product
4. Verify Storefront PDP gallery

## Batch script (planned)

```powershell
# Forthcoming: scripts/import-product-images.cjs
#   --dir imports/product-images
#   --report missing.csv
```

This session does **not** generate fake AI images. Operator supplies files.

## Fallback

Storefront shows letter placeholder when media URL missing (current behavior).
