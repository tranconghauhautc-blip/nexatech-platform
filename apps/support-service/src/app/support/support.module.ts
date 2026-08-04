import { Module } from '@nestjs/common';
import { AdminSupportController } from './admin-support.controller';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type SupportEventPublisher,
} from './event-publisher';
import {
  HttpMediaClient,
  InMemoryMediaClient,
  type MediaClient,
} from './media.client';
import {
  HttpOrderClient,
  InMemoryOrderClient,
  type OrderClient,
} from './order.client';
import { OutboxDispatcher } from './outbox.dispatcher';
import { PrismaService } from './prisma.service';
import { PrismaSupportRepository } from './prisma-support.repository';
import {
  InMemorySupportRepository,
  SUPPORT_REPOSITORY,
  type SupportRepository,
} from './support.repository';
import { SupportService } from './support.service';
import { TicketsController } from './tickets.controller';

export const SUPPORT_EVENT_PUBLISHER = Symbol('SUPPORT_EVENT_PUBLISHER');
export const ORDER_CLIENT = Symbol('ORDER_CLIENT');
export const MEDIA_CLIENT = Symbol('MEDIA_CLIENT');

function createRepositoryProvider() {
  const dbUrl =
    process.env['SUPPORT_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: SUPPORT_REPOSITORY,
        useFactory: (prisma: PrismaService): SupportRepository =>
          new PrismaSupportRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: SUPPORT_REPOSITORY,
        useClass: InMemorySupportRepository,
      },
    ];
  }
  throw new Error(
    'SUPPORT_DATABASE_URL báº¯t buá»™c khi cháº¡y support-service (trá»« NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL']?.trim();
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: SUPPORT_EVENT_PUBLISHER,
      useFactory: (): SupportEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: SUPPORT_EVENT_PUBLISHER,
      useClass: InMemoryEventPublisher,
    };
  }
  throw new Error(
    'RABBITMQ_URL bắt buộc khi chạy service (không silent fallback InMemoryEventPublisher)',
  );
}

function createOrderClientProvider() {
  const orderUrl = process.env['ORDER_SERVICE_URL']?.trim();
  if (orderUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: ORDER_CLIENT,
      useFactory: (): OrderClient => new HttpOrderClient(orderUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: ORDER_CLIENT,
      useClass: InMemoryOrderClient,
    };
  }
  throw new Error(
    'ORDER_SERVICE_URL báº¯t buá»™c khi cháº¡y support-service (khÃ´ng silent fallback InMemory)',
  );
}

function createMediaClientProvider() {
  const mediaUrl = process.env['MEDIA_SERVICE_URL']?.trim();
  if (mediaUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: MEDIA_CLIENT,
      useFactory: (): MediaClient => new HttpMediaClient(mediaUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: MEDIA_CLIENT,
      useClass: InMemoryMediaClient,
    };
  }
  throw new Error(
    'MEDIA_SERVICE_URL báº¯t buá»™c khi cháº¡y support-service (khÃ´ng silent fallback InMemory)',
  );
}

@Module({
  controllers: [TicketsController, AdminSupportController],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createOrderClientProvider(),
    createMediaClientProvider(),
    {
      provide: SupportService,
      useFactory: (
        repository: SupportRepository,
        orderClient: OrderClient,
        mediaClient: MediaClient,
        publisher: SupportEventPublisher,
      ) => new SupportService(repository, orderClient, mediaClient, publisher),
      inject: [
        SUPPORT_REPOSITORY,
        ORDER_CLIENT,
        MEDIA_CLIENT,
        SUPPORT_EVENT_PUBLISHER,
      ],
    },
    {
      provide: OutboxDispatcher,
      useFactory: (
        repository: SupportRepository,
        publisher: SupportEventPublisher,
      ) => new OutboxDispatcher(repository, publisher),
      inject: [SUPPORT_REPOSITORY, SUPPORT_EVENT_PUBLISHER],
    },
  ],
})
export class SupportModule {}
