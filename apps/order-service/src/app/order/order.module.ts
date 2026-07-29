import { Module } from '@nestjs/common';
import { AdminOrderController } from './admin-order.controller';
import { CartClient, HttpCartClient, InMemoryCartClient } from './cart.client';
import {
  CatalogClient,
  HttpCatalogClient,
  InMemoryCatalogClient,
} from './catalog.client';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type OrderEventPublisher,
} from './event-publisher';
import {
  HttpInventoryClient,
  InMemoryInventoryClient,
  type InventoryClient,
} from './inventory.client';
import { OrderController } from './order.controller';
import {
  InMemoryOrderRepository,
  ORDER_REPOSITORY,
  type OrderRepository,
} from './order.repository';
import { OrderService } from './order.service';
import { PrismaOrderRepository } from './prisma-order.repository';
import { PrismaService } from './prisma.service';

export const ORDER_EVENT_PUBLISHER = Symbol('ORDER_EVENT_PUBLISHER');
export const CATALOG_CLIENT = Symbol('CATALOG_CLIENT');
export const CART_CLIENT = Symbol('CART_CLIENT');
export const INVENTORY_CLIENT = Symbol('INVENTORY_CLIENT');

function createRepositoryProvider() {
  const dbUrl =
    process.env['ORDER_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: ORDER_REPOSITORY,
        useFactory: (prisma: PrismaService): OrderRepository =>
          new PrismaOrderRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: ORDER_REPOSITORY,
        useClass: InMemoryOrderRepository,
      },
    ];
  }
  throw new Error(
    'ORDER_DATABASE_URL bắt buộc khi chạy order-service (trừ NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL'];
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: ORDER_EVENT_PUBLISHER,
      useFactory: (): OrderEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  return {
    provide: ORDER_EVENT_PUBLISHER,
    useClass: InMemoryEventPublisher,
  };
}

function createCatalogProvider() {
  const catalogUrl = process.env['CATALOG_SERVICE_URL'];
  if (catalogUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CATALOG_CLIENT,
      useFactory: (): CatalogClient => new HttpCatalogClient(catalogUrl),
    };
  }
  return {
    provide: CATALOG_CLIENT,
    useClass: InMemoryCatalogClient,
  };
}

function createCartProvider() {
  const cartUrl = process.env['CART_SERVICE_URL'];
  if (cartUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CART_CLIENT,
      useFactory: (): CartClient => new HttpCartClient(cartUrl),
    };
  }
  return {
    provide: CART_CLIENT,
    useClass: InMemoryCartClient,
  };
}

function createInventoryProvider() {
  const inventoryUrl = process.env['INVENTORY_SERVICE_URL'];
  if (inventoryUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: INVENTORY_CLIENT,
      useFactory: (): InventoryClient => new HttpInventoryClient(inventoryUrl),
    };
  }
  return {
    provide: INVENTORY_CLIENT,
    useClass: InMemoryInventoryClient,
  };
}

@Module({
  controllers: [OrderController, AdminOrderController],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createCatalogProvider(),
    createCartProvider(),
    createInventoryProvider(),
    {
      provide: OrderService,
      useFactory: (
        repository: OrderRepository,
        catalog: CatalogClient,
        cart: CartClient,
        inventory: InventoryClient,
        publisher: OrderEventPublisher,
      ) => new OrderService(repository, catalog, cart, inventory, publisher),
      inject: [
        ORDER_REPOSITORY,
        CATALOG_CLIENT,
        CART_CLIENT,
        INVENTORY_CLIENT,
        ORDER_EVENT_PUBLISHER,
      ],
    },
  ],
})
export class OrderModule {}
