# NexaTech

NexaTech là nền tảng thương mại điện tử microservices bằng tiếng Việt, bán điện thoại, laptop, tablet, đồng hồ thông minh, tai nghe/loa và phụ kiện.

## Công nghệ

Nx 22.7.7 · pnpm · TypeScript strict · Next.js · NestJS · Prisma · PostgreSQL 16 · Redis · RabbitMQ · MinIO · Kong · Docker · Kubernetes · Helm

## Tài liệu

| Tài liệu                                           | Nội dung             |
| -------------------------------------------------- | -------------------- |
| [docs/PROGRESS.md](docs/PROGRESS.md)               | Tiến độ milestone    |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)       | Kiến trúc hệ thống   |
| [docs/DECISIONS.md](docs/DECISIONS.md)             | Quyết định kỹ thuật  |
| [docs/API-CONTRACTS.md](docs/API-CONTRACTS.md)     | Hợp đồng REST        |
| [docs/DATABASES.md](docs/DATABASES.md)             | Database per service |
| [docs/EVENTS.md](docs/EVENTS.md)                   | RabbitMQ events      |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)           | Deploy & runtime     |
| [docs/TESTING.md](docs/TESTING.md)                 | Chiến lược kiểm thử  |
| [docs/OWASP-SCENARIOS.md](docs/OWASP-SCENARIOS.md) | Kịch bản OWASP API   |

## Trạng thái

- **M0** ✅ kiến trúc & docs
- **M1** ✅ Nx monorepo + TypeScript strict + Jest
- **M2** ✅ shared libraries (errors/config/auth/contracts/events/logging)
- Tiếp theo: **M3** identity + customer

Xem chi tiết tại `docs/PROGRESS.md`.

## Yêu cầu máy local

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose
- Git

## Lệnh thường dùng

```bash
pnpm format
pnpm lint
pnpm test
pnpm build
```
