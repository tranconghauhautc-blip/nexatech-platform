import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connectWithRetry } from '@nexatech/shared-platform';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env['CART_DATABASE_URL'] ?? process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('CART_DATABASE_URL bắt buộc khi dùng Prisma');
    }
    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await connectWithRetry(() => this.$connect(), {
      onRetry: (attempt, maxAttempts, error) =>
        PrismaService.logger.warn(
          `Kết nối database thất bại (lần ${attempt}/${maxAttempts}), thử lại: ${String(error)}`,
        ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
