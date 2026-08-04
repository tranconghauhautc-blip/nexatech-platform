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
    'CART_DATABASE_URL báº¯t buá»™c khi cháº¡y cart-service (trá»« NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL']?.trim();
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CART_EVENT_PUBLISHER,
      useFactory: (): CartEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: CART_EVENT_PUBLISHER,
      useClass: InMemoryEventPublisher,
    };
  }
  throw new Error(
    'RABBITMQ_URL bắt buộc khi chạy service (không silent fallback InMemoryEventPublisher)',
  );
}

function createRedisProvider() {
  const redisUrl = process.env['REDIS_URL']?.trim();
  if (redisUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CART_REDIS,
      useFactory: (): CartRedisStore => new RedisCartStore(redisUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: CART_REDIS,
      useClass: InMemoryCartRedisStore,
    };
  }
  throw new Error(
    'REDIS_URL bắt buộc khi chạy cart-service (không silent fallback InMemoryCartRedisStore)',
  );
}

function createCatalogProvider() {
  const catalogUrl = process.env['CATALOG_SERVICE_URL']?.trim();
  if (catalogUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: CATALOG_CLIENT,
      useFactory: (): CatalogClient => new HttpCatalogClient(catalogUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: CATALOG_CLIENT,
      useClass: InMemoryCatalogClient,
    };
  }
  throw new Error(
    'CATALOG_SERVICE_URL bắt buộc khi chạy cart-service (không silent fallback InMemory)',
  );
}

function createInventoryProvider() {
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
    'INVENTORY_SERVICE_URL bắt buộc khi chạy cart-service (không silent fallback InMemory)',
  );
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
