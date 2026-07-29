import { Module } from '@nestjs/common';
import { AdminInventoryController } from './admin-inventory.controller';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type InventoryEventPublisher,
} from './event-publisher';
import { InventoryController } from './inventory.controller';
import {
  INVENTORY_REPOSITORY,
  InMemoryInventoryRepository,
  type InventoryRepository,
} from './inventory.repository';
import { InventoryService } from './inventory.service';
import { PrismaInventoryRepository } from './prisma-inventory.repository';
import { PrismaService } from './prisma.service';

export const INVENTORY_EVENT_PUBLISHER = Symbol('INVENTORY_EVENT_PUBLISHER');

function createRepositoryProvider() {
  const dbUrl = process.env['INVENTORY_DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: INVENTORY_REPOSITORY,
        useFactory: (prisma: PrismaService): InventoryRepository =>
          new PrismaInventoryRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: INVENTORY_REPOSITORY,
        useClass: InMemoryInventoryRepository,
      },
    ];
  }
  throw new Error(
    'INVENTORY_DATABASE_URL bắt buộc khi chạy inventory-service (trừ NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL'];
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: INVENTORY_EVENT_PUBLISHER,
      useFactory: (): InventoryEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  return {
    provide: INVENTORY_EVENT_PUBLISHER,
    useClass: InMemoryEventPublisher,
  };
}

@Module({
  controllers: [InventoryController, AdminInventoryController],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    {
      provide: InventoryService,
      useFactory: (
        repository: InventoryRepository,
        publisher: InventoryEventPublisher,
      ) => new InventoryService(repository, publisher),
      inject: [INVENTORY_REPOSITORY, INVENTORY_EVENT_PUBLISHER],
    },
  ],
})
export class InventoryModule {}
