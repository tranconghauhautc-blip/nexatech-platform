/\*\*

- LOCAL-MINIMAL-RESET
-
- ## Command
-
- ```powershell

  ```

- $env:NODE_ENV="development"
- $env:NEXATECH_ALLOW_DEV_SEED="YES"
- $env:NEXATECH_ALLOW_MINIMAL_RESET="YES"
- $env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
- $env:DEV_SEED_RESET_PASSWORD="YES"
- pnpm lab:reset:minimal
- ```

  ```

-
- Optional: `$env:NEXATECH_RESET_SKIP_RESTART="YES"` to skip Compose restart.
-
- ## Safety guard
-
- Refuses when any of:
- - `NODE_ENV=production`
- - `NEXATECH_ALLOW_DEV_SEED` ≠ `YES`
- - `NEXATECH_ALLOW_MINIMAL_RESET` ≠ `YES`
- - `DEV_SEED_PASSWORD` missing / weak
- - Database URL host looks non-local (prod/cloud)
-
- Does **not** drop schemas, delete `_prisma_migrations`, remove volumes, or
- run against production hosts.
-
- ## Data removed
-
- All domain tables in: catalog, media, inventory, cart, order, payment,
- shipping, review, warranty, support, notification, reporting, customer,
- identity (then reseed). Also MinIO application objects in buckets
- `product-media`, `review-media`, `support-attachments`, `invoices`, `misc`,
- Redis DB flush, RabbitMQ queue purge (best-effort).
-
- Categories and brands are cleared — they are **not** required for boot;
- owner recreates them via Admin UI.
-
- ## Data retained
-
- - PostgreSQL schemas + Prisma migration history
- - Docker / Kong / Compose infrastructure config
- - Vietnam administrative reference files under `data/vietnam-administrative`
- - Intentional always-on security lab behavior
-
- ## Expected post-reset state
-
- - 4 internal accounts: Staff, Manager, Admin, SuperAdmin (`*@nexatech.local`)
- - Exactly 2 customers with profiles + default addresses + preferences
- - Empty products / media / carts / orders / payments / shipments / notifications
- - Empty reporting projections
- - MinIO app buckets empty of prior product objects
    \*/
