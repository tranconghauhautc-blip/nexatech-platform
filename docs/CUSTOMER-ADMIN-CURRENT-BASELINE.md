# CUSTOMER + ADMIN CURRENT BASELINE

> Snapshot **2026-08-02** after code audit + Docker health probe. Living doc during re-baseline.

## Runtime

All Compose services healthy (14 Nest + storefront + admin + Kong + infra + swagger + security-guide).

HEAD at session start: `eab86ca` on `main`, clean working tree.

## Customer Storefront — route status

| Route                      | Status                  | Notes                                                                   |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `/dang-nhap` … auth        | COMPLETE                | Working                                                                 |
| `/tai-khoan/ho-so`         | PARTIAL                 | Address CRUD free-text; VN selector in progress                         |
| `/gio-hang`                | COMPLETE                | Badge via CartProvider                                                  |
| `/thanh-toan`              | PARTIAL→FIXED in source | Saved address picker; pickup store cards; `pickupStoreId`; cart refresh |
| `/tai-khoan/don-hang`      | PARTIAL→FIXED           | Uses `orderCode`                                                        |
| `/tai-khoan/don-hang/[id]` | PARTIAL→FIXED           | Items, address, pickup vs shipment                                      |
| `/tai-khoan/thanh-toan`    | BROKEN→FIXED            | `GET /payments/me`                                                      |
| `/tai-khoan/yeu-thich`     | PARTIAL→FIXED           | Hydrate via `/products/summaries`                                       |
| `/tai-khoan/so-sanh`       | PARTIAL                 | Needs verify persistence                                                |
| `/tai-khoan/da-xem`        | PARTIAL                 | Tracker exists                                                          |
| `/tai-khoan/danh-gia`      | BROKEN→FIXED            | `GET /reviews/me` + empty CTA                                           |
| `/tai-khoan/bao-hanh`      | PARTIAL→FIXED           | Create form + CTA                                                       |
| `/tai-khoan/ho-tro`        | PARTIAL→FIXED           | Create form + CTA                                                       |
| `/tai-khoan/thong-bao`     | PARTIAL                 | Order notifications exist                                               |

## Admin Portal — module status (pre-completion)

| Module        | Route              | Status                                       |
| ------------- | ------------------ | -------------------------------------------- |
| Dashboard     | `/bang-dieu-khien` | PARTIAL                                      |
| Products      | `/san-pham`        | BROKEN price → fixed source; CRUD incomplete |
| Categories    | `/danh-muc`        | PARTIAL                                      |
| Brands        | `/thuong-hieu`     | PARTIAL                                      |
| Specs         | `/thong-so`        | PARTIAL                                      |
| Media         | `/media`           | PARTIAL — raw Entity ID; upload incomplete   |
| Inventory     | `/kho-hang`        | PARTIAL — raw location UUID                  |
| Stores        | `/cua-hang-kho`    | PARTIAL                                      |
| Orders        | `/don-hang`        | BROKEN code → fixed; workflow incomplete     |
| Payments      | `/thanh-toan`      | PARTIAL                                      |
| Shipping      | `/van-chuyen`      | PARTIAL — no auto shipment on confirm        |
| Reviews       | `/danh-gia`        | PARTIAL                                      |
| Warranty      | `/bao-hanh`        | PARTIAL — count vs list drift                |
| Support       | `/ho-tro`          | PARTIAL                                      |
| Notifications | `/thong-bao`       | PARTIAL                                      |
| Reporting     | `/bao-cao`         | BROKEN field mapping                         |
| Audit         | `/nhat-ky`         | BROKEN empty projection                      |
| Users         | `/nguoi-dung`      | PARTIAL — Lab leak in ops table              |

## Verified root causes

See `docs/CURRENT-PROJECT-BASELINE.md` §9.
