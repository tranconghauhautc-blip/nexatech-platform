# Current Project Baseline

**Branch:** `fix/media-upload-profile-minimal-reset`  
**Starting commit:** `92689d5` (`fix: complete pickup runtime acceptance and audit integration`)  
**HEAD (uncommitted work on top of baseline):** same commit; all RC work is **uncommitted**  
**Date:** 2026-08-03  
**Owner gate:** Do not commit / do not push until review.

## Runtime stack

Docker Compose apps `0.17.0` + infra (Postgres 16, Redis, RabbitMQ, MinIO, Kong). Recreated this session: catalog, customer, media, admin-web, storefront-web.

## Manually preserved commerce data

Five categories, brand NexaTech, warehouse HN-MAIN, store HCM-NGUYEN-HUE, product Nova X1 + SKU NT-PHONE-NX1-BLK, one primary PNG media link, spec template with `ram_gb`, two customer profiles. **Stock not initialized.**

## Major uncommitted deltas (this RC)

- Admin light theme + micro-interactions
- Spec template PATCH/DELETE + Admin UI
- Inventory Admin mutations UI
- Product edit + specs + media primary/unlink
- Dynamic Storefront categories
- Customer account overview, address CRUD, recently-viewed auth sync
- Warranty/review/support UX fixes
- Admin human-readable filters + audit actor resolution
- Prior session: MinIO browser-safe upload, profile route, `lab:reset:minimal`

## Builds

| Target                                         | Result |
| ---------------------------------------------- | ------ |
| Host admin-web                                 | PASS   |
| Host storefront-web                            | PASS   |
| Docker admin/storefront/catalog/customer/media | PASS   |

## Known `/_error` Html issue

Previously documented in PROGRESS; **host builds now succeed** on this machine without workaround. Docker builds also PASS.

## Intentional security posture

Vulnerabilities remain always-on; no secure/lab toggle. OpenAPI 3.0.3 validation emits warnings on missing security declarations (lab-compatible).
