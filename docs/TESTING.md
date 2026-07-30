# NexaTech Testing Strategy

## Mục tiêu

Mỗi milestone phải xanh:

1. Format
2. Lint
3. Unit test
4. Integration test phù hợp
5. Build

Toàn hệ thống (M20):

- API tests
- Playwright E2E
- k6 smoke/load
- Migration tests
- Docker image smoke

## Unit tests

- NestJS services/controllers/use-cases
- Domain pure functions (pricing rules, stock math, RBAC checks)
- Frontend utils/hooks (khi có logic)

Runner: Jest (Nx default) hoặc Vitest nếu Nx generator chọn — thống nhất trong monorepo tại M1.

## Integration tests

- Prisma + PostgreSQL test DB
- Redis cho session/OTP
- RabbitMQ publish/consume (testcontainer hoặc compose profile `test`)
- MinIO presign (optional)

## API tests

- Supertest / Pact-like contract từ `libs/shared/contracts`
- Cover auth, happy path checkout, error envelope

## E2E (Playwright)

Luồng tối thiểu:

1. Đăng ký / đăng nhập
2. Duyệt catalog → thêm giỏ
3. Checkout COD
4. Xem đơn
5. Admin cập nhật trạng thái cơ bản

## k6

- Smoke: health endpoints tất cả service
- Load nhẹ: product list + cart add
- Threshold lỗi và latency ghi trong `tests/k6/`

## Definition of Done mỗi milestone

- [ ] Code business thật (không placeholder rỗng)
- [ ] Format pass
- [ ] Lint pass
- [ ] Unit tests pass
- [ ] Integration tests liên quan pass (nếu có)
- [ ] Build pass
- [ ] Docs cập nhật
- [ ] Git commit cục bộ

## Lệnh chuẩn

```bash
pnpm format
pnpm lint
pnpm test
pnpm build
pnpm typecheck
```

Scripts dùng `cross-env NX_SKIP_NATIVE_FILE_CACHE=true NX_DAEMON=false` (xem ADR-018).

## Unit tests hiện có

| Project             | Coverage focus                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-platform`   | ID generation, assertDefined, pagination, constants                                                                                                                                                       |
| `shared-errors`     | Error envelope + AppError                                                                                                                                                                                 |
| `shared-contracts`  | Pagination, auth schemas, category slugs                                                                                                                                                                  |
| `shared-auth`       | RBAC ranks                                                                                                                                                                                                |
| `shared-events`     | Event envelope + routing keys                                                                                                                                                                             |
| `shared-config`     | Zod env loading                                                                                                                                                                                           |
| `shared-logging`    | Correlation + structured logger                                                                                                                                                                           |
| `identity-service`  | Register/login/OTP/refresh/reset                                                                                                                                                                          |
| `customer-service`  | Profile + addresses                                                                                                                                                                                       |
| `catalog-service`   | Catalog business + controller smoke; Prisma/migration khi có DB URL                                                                                                                                       |
| `media-service`     | Presign/ownership/MIME; Prisma/MinIO/migration khi có env                                                                                                                                                 |
| `inventory-service` | Warehouse/store/stock lifecycle, idempotency, low-stock event, concurrency (parallel reserve/issue); Prisma/migration/RabbitMQ khi có env                                                                 |
| `cart-service`      | Guest/user cart, merge, ownership, idempotency, concurrency add, price refresh, inventory pre-check, convert; Prisma/migration/Redis khi có env                                                           |
| `order-service`     | Create from cart, re-price, reserve, snapshot, packages, state machine, cancel/confirm, ownership/RBAC, idempotency, concurrency, outbox; Prisma/migration khi có `ORDER_DATABASE_URL`                    |
| `payment-service`   | Payment intent COD/MOCK/VNPay, ownership, state machine, mock succeed/fail, VNPay signature/amount/replay, refund full/partial/double, outbox, order sync; Prisma/migration khi có `PAYMENT_DATABASE_URL` |

## Integration (M4–M8)

Bật Compose rồi set `CATALOG_DATABASE_URL`, `MEDIA_DATABASE_URL`, `MINIO_*`, `INVENTORY_DATABASE_URL`, `CART_DATABASE_URL`, `ORDER_DATABASE_URL`, `PAYMENT_DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL` (optional) trước `pnpm test`.
Tests tự skip nếu thiếu env.

`inventory.concurrency.spec.ts` chạy song song nhiều lệnh `reserveStock`/`issueStock` bằng `InMemoryInventoryRepository` và khẳng định bất biến `reserved <= onHand` cùng `onHand >= 0` luôn đúng; các lần thất bại phải là `INVENTORY_INSUFFICIENT` hoặc `INVENTORY_CONFLICT`.

`cart.concurrency.spec.ts` thêm cùng SKU song song vào customer cart; tổng số lượng cuối cùng phải bằng số lần add (không lost update nhờ lock + optimistic version).

`payment.concurrency.spec.ts` xử lý callback trùng / song song; chỉ một lần chuyển `PAID`.
