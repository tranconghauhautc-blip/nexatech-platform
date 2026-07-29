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

## Lệnh chuẩn (sau M1)

```bash
pnpm format
pnpm lint
pnpm test
pnpm build
```

Chi tiết Nx targets sẽ được bổ sung khi monorepo sẵn sàng.
