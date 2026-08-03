# CURRENT PROJECT BASELINE

> Re-baselined **2026-08-03** after full runtime acceptance. Prefer this over older snapshots.
> **No commit in this phase** (owner review gate).

## 1. HEAD / branch / working tree

| Item | Value |
| ---- | ----- |
| Branch | `fix/full-runtime-acceptance` |
| Checkpoint HEAD | `8cf5c1b` — restore store pickup with CRUD, seed, filtering |
| Working tree | **Dirty** — inventory audit publish, reporting extract, media:audit, pickup COD e2e, docs |
| Remote | Do not push until owner approves |

## 2. Frontend / backends / infra

Unchanged port map (storefront 3000, admin 3100, Nest 3001–3014, Kong 8000, Swagger 8090, Security Guide 3200, Postgres/Redis/Rabbit/MinIO).

**Runtime:** healthy; rebuilt `inventory-service`, `reporting-service` this session.

## 3. OpenAPI

| Item | State |
| ---- | ----- |
| Version | **3.0.3** |
| Combined paths | **391** |
| Pickup | `/api/v1|v2/stores/pickup` present |

## 4. Acceptance posture

Store Pickup and authenticated Admin/Customer browser flows elevated to **PASS_BROWSER** with Compose evidence. Full automated gates green. Awaiting owner review before commit.
