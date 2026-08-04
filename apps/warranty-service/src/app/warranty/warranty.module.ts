import { Module } from '@nestjs/common';
import { AdminWarrantyController } from './admin-warranty.controller';
import { ClaimsController } from './claims.controller';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type WarrantyEventPublisher,
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
import { PrismaWarrantyRepository } from './prisma-warranty.repository';
import { ReturnsController } from './returns.controller';
import {
  InMemoryWarrantyRepository,
  WARRANTY_REPOSITORY,
  type WarrantyRepository,
} from './warranty.repository';
import { WarrantyService } from './warranty.service';

export const WARRANTY_EVENT_PUBLISHER = Symbol('WARRANTY_EVENT_PUBLISHER');
export const ORDER_CLIENT = Symbol('ORDER_CLIENT');
export const MEDIA_CLIENT = Symbol('MEDIA_CLIENT');

function createRepositoryProvider() {
  const dbUrl =
    process.env['WARRANTY_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: WARRANTY_REPOSITORY,
        useFactory: (prisma: PrismaService): WarrantyRepository =>
          new PrismaWarrantyRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: WARRANTY_REPOSITORY,
        useClass: InMemoryWarrantyRepository,
      },
    ];
  }
  throw new Error(
    'WARRANTY_DATABASE_URL báº¯t buá»™c khi cháº¡y warranty-service (trá»« NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL']?.trim();
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: WARRANTY_EVENT_PUBLISHER,
      useFactory: (): WarrantyEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: WARRANTY_EVENT_PUBLISHER,
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
    'ORDER_SERVICE_URL báº¯t buá»™c khi cháº¡y warranty-service (khÃ´ng silent fallback InMemory)',
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
    'MEDIA_SERVICE_URL báº¯t buá»™c khi cháº¡y warranty-service (khÃ´ng silent fallback InMemory)',
  );
}

@Module({
  controllers: [ClaimsController, ReturnsController, AdminWarrantyController],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createOrderClientProvider(),
    createMediaClientProvider(),
    {
      provide: WarrantyService,
      useFactory: (
        repository: WarrantyRepository,
        orderClient: OrderClient,
        mediaClient: MediaClient,
        publisher: WarrantyEventPublisher,
      ) => new WarrantyService(repository, orderClient, mediaClient, publisher),
      inject: [
        WARRANTY_REPOSITORY,
        ORDER_CLIENT,
        MEDIA_CLIENT,
        WARRANTY_EVENT_PUBLISHER,
      ],
    },
    {
      provide: OutboxDispatcher,
      useFactory: (
        repository: WarrantyRepository,
        publisher: WarrantyEventPublisher,
      ) => new OutboxDispatcher(repository, publisher),
      inject: [WARRANTY_REPOSITORY, WARRANTY_EVENT_PUBLISHER],
    },
  ],
})
export class WarrantyModule {}
