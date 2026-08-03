# Owner Manual Test Checklist

> Local Compose · **2026-08-03** · Không ghi password trong file này.
> Accounts: `customer1@nexatech.local`, `customer2@nexatech.local`, staff/manager/admin/superadmin seed emails.
> Password: dùng `DEV_SEED_PASSWORD` / `E2E_DEV_SEED_PASSWORD` trên máy owner (không commit).

## Cách lấy evidence khi lỗi

1. Browser DevTools → Network: request URL, status, response JSON (`errorCode`, `traceId`).
2. `docker logs docker-<service>-1 --tail 100`
3. Screenshot UI + URL + account role (không chụp password).

---

## A. Customer

| # | URL | Account | Thao tác | Mong đợi |
| - | --- | ------- | -------- | -------- |
| C1 | http://localhost:3000/dang-nhap | customer1 | Login | Vào tài khoản; cookie session |
| C2 | http://localhost:3000/tai-khoan | customer1 | Mở hồ sơ | Không OTP bất thường |
| C3 | http://localhost:3000/tai-khoan/ho-so | customer1 | Thêm địa chỉ tỉnh/phường | Lưu được; refresh còn; không bắt district |
| C4 | http://localhost:3000 | customer1 | Duyệt SP, thêm giỏ | Badge cập nhật |
| C5 | http://localhost:3000/thanh-toan | customer1 | STANDARD + COD | 1 order; cart = 0 |
| C6 | http://localhost:3000/thanh-toan | customer1 | EXPRESS + MOCK | Order + payment |
| C7 | http://localhost:3000/thanh-toan | customer1 | **Nhận tại cửa hàng** | Thấy **NexaTech Nguyễn Huệ** (không raw UUID); chọn store → đặt hàng OK |
| C8 | http://localhost:3000/tai-khoan/don-hang | customer1 | Chi tiết pickup | Tên/địa chỉ/SĐT/giờ CH; không bắt shipment |
| C9 | http://localhost:3000/tai-khoan/thanh-toan | customer1/2 | Payments | 200; isolation; empty OK |
| C10 | http://localhost:3000/tai-khoan/danh-gia | customer1/2 | Reviews | 200; empty CTA |

## B. Admin / Store / Pickup

| # | URL | Role | Thao tác | Mong đợi |
| - | --- | ---- | -------- | -------- |
| A1 | http://localhost:3100/dang-nhap | Admin | Login | Vào portal |
| A2 | http://localhost:3100/cua-hang-kho | Admin | Tab Cửa hàng | Thấy HCM-NGUYEN-HUE; nút **+ Thêm** / **Sửa** |
| A3 | http://localhost:3100/cua-hang-kho | Staff | Login Staff | Xem được; **không** nút tạo/sửa (API 403 nếu gọi) |
| A4 | http://localhost:3100/cua-hang-kho | Admin | Tab Kho | HN-MAIN vẫn là kho; không đổi thành store |
| A5 | http://localhost:3100/cua-hang-kho | Manager+ | Tắt pickup / inactive | Checkout không còn store đó |
| A6 | http://localhost:3100/don-hang | Admin | Đơn pickup | Badge STORE_PICKUP; không báo thiếu shipment bắt buộc |

## C. Product / Media

| # | URL | Role | Thao tác | Mong đợi |
| - | --- | ---- | -------- | -------- |
| M1 | http://localhost:3100/san-pham | Admin | List | Giá > 0; không UUID làm title chính |
| M2 | http://localhost:3100/media | Admin | Upload JPEG/PNG/WebP | MinIO object; Storefront hiện ảnh |
| M3 | Storefront PDP | — | Gallery | URL không chứa `minio:9000` |

## D. Swagger / Kong

| # | URL | Thao tác | Mong đợi |
| - | --- | -------- | -------- |
| S1 | http://localhost:8090 | Mở Combined | openapi 3.0.3 |
| S2 | Kong `GET http://localhost:8000/api/v1/stores/pickup` | Không auth | 200 + HCM-NGUYEN-HUE |
| S3 | Direct `GET http://localhost:3005/api/v1/stores/pickup` | — | Giống Kong |
| S4 | `POST .../admin/inventory/stores` header `x-user-roles: Staff` | — | 403 |

## E. Security Guide

| # | URL | Mong đợi |
| - | --- | -------- |
| G1 | http://localhost:3200 | Portal load; scenario links còn |
| G2 | Intentional vulns | Always-on; không tắt lab |

## F. Restart persistence

1. `docker compose ... stop inventory-service && start inventory-service` (không `-v`).
2. `GET /api/v1/stores/pickup` vẫn trả HCM-NGUYEN-HUE.
3. Login customer + địa chỉ + đơn cũ vẫn còn.

## Seed (nếu thiếu store)

```powershell
$env:NEXATECH_ALLOW_DEV_SEED='YES'
pnpm seed:pickup-stores
```
