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

## Batch script

```powershell
# Generate lab placeholder PNGs (slug + sku stems) when owner photos are not ready
pnpm generate:product-images -- --dir imports/product-images

# Dry-run mapping report (no upload)
pnpm import:product-images -- --dir imports/product-images --dry-run --report report.json

# Upload via Compose network (presigned URL uses Host=minio)
docker run --rm --network nexatech-dev `
  -v "${PWD}:/work" -w /work `
  -e NEXATECH_ALLOW_DEV_SEED=YES `
  -e CATALOG_API_BASE=http://catalog-service:3003 `
  -e MEDIA_API_BASE=http://media-service:3004 `
  node:22-bookworm-slim `
  node scripts/import-product-images.cjs --dir imports/product-images --report report.json
```

Also: `pnpm import:product-images -- --dir imports/product-images --dry-run`

> Host-side upload against `http://minio:9000` fails signature. Prefer the Docker network runner above.

## Fallback

Storefront shows letter placeholder when media URL missing (current behavior).
