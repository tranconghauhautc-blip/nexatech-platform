import { Module } from '@nestjs/common';
import { AdminShippingController } from './admin-shipping.controller';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type ShippingEventPublisher,
} from './event-publisher';
import {
  HttpInventoryClient,
  InMemoryInventoryClient,
  type InventoryClient,
} from './inventory.client';
import {
  HttpOrderClient,
  InMemoryOrderClient,
  type OrderClient,
} from './order.client';
import { PrismaService } from './prisma.service';
import { PrismaShippingRepository } from './prisma-shipping.repository';
import {
  ShipmentsController,
  ShippingQuotesSlotsController,
} from './shipping.controller';
import {
  InMemoryShippingRepository,
  SHIPPING_REPOSITORY,
  type ShippingRepository,
} from './shipping.repository';
import { ShippingService } from './shipping.service';

export const SHIPPING_EVENT_PUBLISHER = Symbol('SHIPPING_EVENT_PUBLISHER');
export const ORDER_CLIENT = Symbol('ORDER_CLIENT');
export const INVENTORY_CLIENT = Symbol('INVENTORY_CLIENT');

function createRepositoryProvider() {
  const dbUrl =
    process.env['SHIPPING_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: SHIPPING_REPOSITORY,
        useFactory: (prisma: PrismaService): ShippingRepository =>
          new PrismaShippingRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: SHIPPING_REPOSITORY,
        useClass: InMemoryShippingRepository,
      },
    ];
  }
  throw new Error(
    'SHIPPING_DATABASE_URL báº¯t buá»™c khi cháº¡y shipping-service (trá»« NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL']?.trim();
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: SHIPPING_EVENT_PUBLISHER,
      useFactory: (): ShippingEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: SHIPPING_EVENT_PUBLISHER,
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
    'ORDER_SERVICE_URL báº¯t buá»™c khi cháº¡y shipping-service (khÃ´ng silent fallback InMemory)',
  );
}

function createInventoryClientProvider() {
  const inventoryUrl = process.env['INVENTORY_SERVICE_URL']?.trim();
  if (inventoryUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: INVENTORY_CLIENT,
      useFactory: (): InventoryClient => new HttpInventoryClient(inventoryUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: INVENTORY_CLIENT,
      useClass: InMemoryInventoryClient,
    };
  }
  throw new Error(
    'INVENTORY_SERVICE_URL báº¯t buá»™c khi cháº¡y shipping-service (khÃ´ng silent fallback InMemory)',
  );
}

@Module({
  controllers: [
    ShippingQuotesSlotsController,
    ShipmentsController,
    AdminShippingController,
  ],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createOrderClientProvider(),
    createInventoryClientProvider(),
    {
      provide: ShippingService,
      useFactory: (
        repository: ShippingRepository,
        orderClient: OrderClient,
        inventoryClient: InventoryClient,
        publisher: ShippingEventPublisher,
      ) =>
        new ShippingService(
          repository,
          orderClient,
          inventoryClient,
          publisher,
        ),
      inject: [
        SHIPPING_REPOSITORY,
        ORDER_CLIENT,
        INVENTORY_CLIENT,
        SHIPPING_EVENT_PUBLISHER,
      ],
    },
  ],
})
export class ShippingModule {}
