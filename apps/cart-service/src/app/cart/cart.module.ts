import { Module } from '@nestjs/common';
import {
  CatalogClient,
  HttpCatalogClient,
  InMemoryCatalogClient,
} from './catalog.client';
import {
  CartController,
  ComparisonController,
  RecentlyViewedController,
  WishlistController,
} from './cart.controller';
import {
  CART_REPOSITORY,
  InMemoryCartRepository,
  type CartRepository,
} from './cart.repository';
import { CartService } from './cart.service';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type CartEventPublisher,
} from './event-publisher';
import {
  HttpInventoryClient,
  InMemoryInventoryClient,
  type InventoryClient,
} from './inventory.client';
import { PrismaCartRepository } from './prisma-cart.repository';
import { PrismaService } from './prisma.service';
import {
  InMemoryCartRedisStore,
  RedisCartStore,
  type CartRedisStore,
} from './redis.store';

export const CART_EVENT_PUBLISHER = Symbol('CART_EVENT_PUBLISHER');
export const CART_REDIS = Symbol('CART_REDIS');
export const CATALOG_CLIENT = Symbol('CATALOG_CLIENT');
export const INVENTORY_CLIENT = Symbol('INVENTORY_CLIENT');

function createRepositoryProvider() {
  const dbUrl = process.env['CART_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: CART_REPOSITORY,
        useFactory: (prisma: PrismaService): CartRepository =>
          new PrismaCartRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: CART_REPOSITORY,
        useClass: InMemoryCartRepository,
      },
    ];
  }
  throw new Error(
    'CART_DATABASE_URL bắt buộc khi chạy cart-service (trừ NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL'];
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CART_EVENT_PUBLISHER,
      useFactory: (): CartEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  return {
    provide: CART_EVENT_PUBLISHER,
    useClass: InMemoryEventPublisher,
  };
}

function createRedisProvider() {
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CART_REDIS,
      useFactory: (): CartRedisStore => new RedisCartStore(redisUrl),
    };
  }
  return {
    provide: CART_REDIS,
    useClass: InMemoryCartRedisStore,
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
  controllers: [
    CartController,
    WishlistController,
    ComparisonController,
    RecentlyViewedController,
  ],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createRedisProvider(),
    createCatalogProvider(),
    createInventoryProvider(),
    {
      provide: CartService,
      useFactory: (
        repository: CartRepository,
        catalog: CatalogClient,
        inventory: InventoryClient,
        redis: CartRedisStore,
        publisher: CartEventPublisher,
      ) => new CartService(repository, catalog, inventory, redis, publisher),
      inject: [
        CART_REPOSITORY,
        CATALOG_CLIENT,
        INVENTORY_CLIENT,
        CART_REDIS,
        CART_EVENT_PUBLISHER,
      ],
    },
  ],
})
export class CartModule {}
