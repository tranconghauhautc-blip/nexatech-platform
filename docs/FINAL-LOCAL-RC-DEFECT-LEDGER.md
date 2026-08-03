# Final Local RC — Defect Ledger

**Branch:** `fix/media-upload-profile-minimal-reset`  
**Starting commit:** `92689d5`  
**Current HEAD:** `92689d5` (uncommitted RC work preserved)  
**Ledger updated:** 2026-08-03  
**OpenAPI:** 3.0.3 validated (`pnpm openapi:validate` PASSED)  
**Security lab vulns:** always-on (no secure/lab toggles)

---

## Route inventory

### Admin Portal (23 pages)

| Route | Feature | Mutations expected |
|-------|---------|-------------------|
| `/` | Redirect | — |
| `/dang-nhap` | Login | Auth |
| `/unauthorized` | 401 | — |
| `/forbidden` | 403 | — |
| `/security-lab` | OWASP training | Always-on PoCs |
| `/bang-dieu-khien` | Dashboard | Read reporting |
| `/san-pham` | Products + SKUs | Create/edit/status/SKU PATCH/price/specs |
| `/danh-muc` | Categories | Create/edit/activate |
| `/thuong-hieu` | Brands | Create/edit/activate |
| `/thong-so` | Spec templates | Create/edit/delete/groups/attrs |
| `/media` | Product media | Presign→PUT→confirm→link/primary/unlink |
| `/kho-hang` | Stock | Receive/issue/adjust + movements |
| `/cua-hang-kho` | Stores & warehouses | Create/edit |
| `/don-hang` | Orders | Detail + confirm/cancel/transition + shipment |
| `/thanh-toan` | Payments | Detail + COD actions |
| `/van-chuyen` | Shipments | Status transitions |
| `/danh-gia` | Reviews | Moderate approve/hide |
| `/bao-hanh` | Warranty | Claim transitions |
| `/ho-tro` | Support | Detail/reply/assign/transition |
| `/thong-bao` | Email log | Read |
| `/bao-cao` | Reporting | Read metrics |
| `/nhat-ky` | Audit | List + detail |
| `/nguoi-dung` | Users | Create/edit/disable |

### Storefront public (14) + Customer account (12)

See initial ledger sections — all enumerated. Storefront categories load from catalog (no hard-coded NAV_CATEGORIES at runtime).

---

## Defects

### DEF-001 — Inventory reservation never committed on fulfilment
- **Severity:** BLOCKER → **FIXED**
- **Fix:** shipping `HttpInventoryClient.commitOnPickup` now POSTs `/api/v1/admin/inventory/reservations/:id/commit` using order `reservationId`; inventory `commitReservation` idempotent when already `COMMITTED`
- **Evidence:** code in shipping/inventory; shipping + inventory unit tests PASS; Docker images rebuilt healthy
- **Residual risk:** live multi-order fulfil→commit not exercised with customer credentials in this sweep (needs owner password for authenticated checkout)

### DEF-002 — Lab StockItem empty for Nova X1
- **Severity:** BLOCKER → **FIXED** (operational data present)
- **Evidence:** PostgreSQL `StockItem` HN-MAIN onHand=10, HCM-NGUYEN-HUE onHand=5; availability API + BFF return total 15; persists after inventory/catalog/storefront container recreate

### DEF-003 — Compare UUID / hydrate / remove
- **Severity:** BLOCKER → **FIXED**

### DEF-004 — Support ticket workflow
- **Severity:** BLOCKER → **FIXED**

### DEF-005 — Missing SKU PATCH
- **Severity:** HIGH → **FIXED** — `PATCH /api/v1/admin/catalog/skus/:skuId` + Admin UI name edit

### DEF-006 — Recently viewed UUID titles
- **Severity:** HIGH → **FIXED**

### DEF-007 — Admin ops read-only
- **Severity:** HIGH → **FIXED** — orders/payments/shipping/reviews/warranty/support drawers wired

### DEF-008 — Movement history UI
- **Severity:** HIGH → **FIXED**

### DEF-009 — Duplicate PDP price
- **Severity:** MEDIUM → **FIXED**

### DEF-010 — Raw native customer forms
- **Severity:** HIGH → **FIXED** — nt-\* classes on support/warranty/review/profile/checkout

### DEF-011 — Spec set incomplete + UUID labels on PDP
- **Severity:** HIGH → **FIXED**
- **Evidence:** template has `ram_gb`/`storage_gb`; Nova X1 values 12 / 256; catalog API returns `attributeLabel`; browser PDP shows “Dung lượng RAM (GB)” / “Bộ nhớ trong (GB)”

### DEF-012 — UUID-as-primary-label in Admin columns
- **Severity:** MEDIUM → **PARTIAL** — human-search + store name resolve on orders; some tooltips still expose IDs

### DEF-013 — Create User autofill
- **Severity:** MEDIUM → **VERIFY** — form has `autocomplete` improvements; owner browser check recommended

### DEF-014 — Guest→auth recently-viewed merge
- **Severity:** MEDIUM → **FIXED** — clear local on auth recent path

### DEF-015 — Warranty returns UI
- **Severity:** MEDIUM → **OPEN** — claims gated; returns list/create still incomplete vs title

### DEF-016 — Docs overclaim inventory commit
- **Severity:** MEDIUM → **FIXED** with DEF-001 (docs updated)

### DEF-017 — Scripts NAV_CATEGORIES import
- **Severity:** LOW → **OPEN** (non-runtime)

### DEF-018 — Login required before add-to-cart despite guest cart
- **Severity:** MEDIUM → **OPEN** — policy still forces login on PDP add

### DEF-019 — In-app notifications generation
- **Severity:** HIGH → **VERIFY** — inbox UI exists; event generation needs owner order lifecycle proof

### DEF-020 — Dashboard fabricated values
- **Severity:** MEDIUM → **VERIFY** — wired to reporting APIs; empty lab shows zeros

### DEF-021 — PDP stock first-paint false OOS / loading
- **Severity:** HIGH → **FIXED** — `stockLoading` defaults true; browser shows “Còn hàng · 15 · 2 điểm cung ứng”

### DEF-022 — PDP media placeholder in automation race
- **Severity:** MEDIUM → **OBSERVED FIXED** — GET signed MinIO URL 200 (HEAD 403 expected); browser shows real PNG after resolve

---

## Severity summary (remaining)

| Severity | Count | IDs |
|----------|-------|-----|
| BLOCKER | 0 | — |
| HIGH | 1 | DEF-019 (VERIFY — needs live order event proof) |
| MEDIUM | 5 | DEF-012 partial, DEF-013 verify, DEF-015, DEF-018, DEF-020 verify |
| LOW | 1 | DEF-017 |

**Rule:** No BLOCKER open. One HIGH remains VERIFY (notifications event generation under real orders).

---

## Closure log

| ID | Closed | Evidence |
|----|--------|----------|
| DEF-001 | 2026-08-03 | Shipping REST commit + idempotent inventory commit; unit tests; Docker rebuild |
| DEF-002 | 2026-08-03 | Stock 10+5 persisted after container recreate; BFF availability |
| DEF-003 | 2026-08-03 | Compare hydrate + DELETE productId |
| DEF-004 | 2026-08-03 | Customer + Admin support detail/reply |
| DEF-005 | 2026-08-03 | SKU PATCH API + Admin UI |
| DEF-006 | 2026-08-03 | Recently-viewed hydrate |
| DEF-007 | 2026-08-03 | Admin ops drawers |
| DEF-008 | 2026-08-03 | Movements UI |
| DEF-009 | 2026-08-03 | Single primary PDP price |
| DEF-010 | 2026-08-03 | nt-\* forms |
| DEF-011 | 2026-08-03 | Spec labels + values on PDP |
| DEF-014 | 2026-08-03 | clear local on auth recent |
| DEF-016 | 2026-08-03 | Docs aligned |
| DEF-021 | 2026-08-03 | stockLoading default true; in-stock badge |
