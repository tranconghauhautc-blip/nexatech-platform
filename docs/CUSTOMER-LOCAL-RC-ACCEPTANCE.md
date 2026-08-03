# Customer Local RC Acceptance

**Branch:** `fix/media-upload-profile-minimal-reset`  
**Baseline:** `92689d5`  
**Date:** 2026-08-03

## Preserved

- Route `/tai-khoan/ho-so` profile edit (`fullName`, `phone`; email read-only)
- Address create + **edit / set default / delete** (DELETE `customers/me/addresses/:id` added)
- 2 customer profiles in DB

## Implemented this session

| Area                          | Result                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Account overview `/tai-khoan` | Real summary cards from order/cart/notification/support/warranty/payment/customer APIs (shows 0 or —; no fabricated counts) |
| Dynamic categories            | Header/footer/home/search/sitemap load Admin active categories only                                                         |
| Recently viewed               | Authenticated POST to cart-service; localStorage guest-only                                                                 |
| Wishlist / compare            | Existing cart-service persistence retained                                                                                  |
| Warranty UI                   | Create gated on DELIVERED eligible orders                                                                                   |
| Support                       | Removed misplaced “Xem đơn hàng” footer                                                                                     |
| Reviews                       | “Viết đánh giá” on delivered order items                                                                                    |
| Cart qty                      | Clamped to inventory `totalAvailable`                                                                                       |
| Storefront visual             | Hero/product cards/buttons/empty states + reduced-motion                                                                    |

## Category sync evidence (runtime)

Storefront HTML after Docker recreate lists only:

- `/danh-muc/dien-thoai` Điện thoại
- `/danh-muc/may-tinh-bang` Máy tính bảng
- `/danh-muc/laptop` Laptop
- `/danh-muc/man-hinh` Màn hình
- `/danh-muc/tai-nghe` Tai nghe

No hard-coded `tablet` / `dong-ho-thong-minh` / `phu-kien` nav entries.

## Owner Phase B–C (manual with customer credentials)

1. Login customer1 → profile/address → Nova X1 specs/media/stock → wishlist/compare/recent → cart qty 2 → COD delivery.
2. Login customer2 → pickup at HCM-NGUYEN-HUE → cancel before handover → reservation release.

**Blocker for automated completion:** stock currently empty; complete Admin Phase A stock init first.
