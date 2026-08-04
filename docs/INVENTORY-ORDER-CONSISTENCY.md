# Inventory–Order Consistency

**Date:** 2026-08-03 (updated after DEF-001 fix)

## Equation

`available = onHand - reserved` (inventory-service; `StockItem` stores `onHand` + `reserved`).

## Admin capabilities

| Action    | Endpoint                                     | UI                        |
| --------- | -------------------------------------------- | ------------------------- |
| Receive   | `POST /api/v1/admin/inventory/stock/receive` | Tồn kho drawer — Nhập kho |
| Issue     | `POST .../stock/issue`                       | Xuất kho                  |
| Adjust    | `POST .../stock/adjust`                      | Điều chỉnh tuyệt đối      |
| Movements | `GET /api/v1/movements?skuCode=`             | Lịch sử xuất/nhập         |

Guards: inactive locations disabled; submit disabled while in-flight; unique idempotency key per click.

## Current lab stock (proven)

| Location       | Type      | onHand | reserved | available |
| -------------- | --------- | ------ | -------- | --------- |
| HN-MAIN        | warehouse | 10     | 0        | 10        |
| HCM-NGUYEN-HUE | store     | 5      | 0        | 5         |

Evidence: read-only SQL + `GET /api/v1/stock/availability` + storefront BFF + browser PDP “Còn hàng · 15 · 2 điểm cung ứng”. Persisted after inventory-service / storefront container recreate.

## Order lifecycle (implemented)

| Event                  | onHand    | reserved | available                           | Mechanism                                                                                        |
| ---------------------- | --------- | -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Reserve buy qty        | unchanged | +qty     | −qty                                | order → `POST .../stock/reserve`                                                                 |
| Fulfil / pickup commit | −qty      | −qty     | unchanged vs post-reserve available | shipping `commitOnPickup` → `POST .../reservations/:id/commit` (idempotent if already COMMITTED) |
| Cancel before fulfil   | unchanged | −qty     | restored                            | order → `POST .../reservations/:id/release`                                                      |

### Commit path (DEF-001)

1. Order create stores `reservationId`.
2. Shipping maps `OrderDto.reservationId` into `OrderSnapshot`.
3. On delivery `PICKED_UP` or store-pickup confirm, shipping calls inventory commit REST with that id.
4. `commitReservation` returns existing reservation when status is already `COMMITTED` (multi-package / retry safe).

## Restart persistence

Inventory PostgreSQL volume retained across `docker compose ... up -d --no-deps inventory-service` recreate. Stock rows remain.

## Note on Kong path

Public inventory routes are `/api/v1/stock/...`. BFF proxies to inventory-service base URL.
