import { Module } from '@nestjs/common';
import {
  HttpCatalogClient,
  InMemoryCatalogClient,
  type CatalogClient,
} from './catalog.client';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type ReviewEventPublisher,
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
import { PrismaReviewRepository } from './prisma-review.repository';
import { AdminReviewController } from './admin-reviews.controller';
import { ProductsReviewsController } from './products-reviews.controller';
import { ReviewsController } from './review.controller';
import {
  InMemoryReviewRepository,
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from './review.repository';
import { ReviewService } from './review.service';

export const REVIEW_EVENT_PUBLISHER = Symbol('REVIEW_EVENT_PUBLISHER');
export const ORDER_CLIENT = Symbol('ORDER_CLIENT');
export const CATALOG_CLIENT = Symbol('CATALOG_CLIENT');
export const MEDIA_CLIENT = Symbol('MEDIA_CLIENT');

function createRepositoryProvider() {
  const dbUrl =
    process.env['REVIEW_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: REVIEW_REPOSITORY,
        useFactory: (prisma: PrismaService): ReviewRepository =>
          new PrismaReviewRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: REVIEW_REPOSITORY,
        useClass: InMemoryReviewRepository,
      },
    ];
  }
  throw new Error(
    'REVIEW_DATABASE_URL báº¯t buá»™c khi cháº¡y review-service (trá»« NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL']?.trim();
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: REVIEW_EVENT_PUBLISHER,
      useFactory: (): ReviewEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: REVIEW_EVENT_PUBLISHER,
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
    'ORDER_SERVICE_URL báº¯t buá»™c khi cháº¡y review-service (khÃ´ng silent fallback InMemory)',
  );
}

function createCatalogClientProvider() {
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
    'CATALOG_SERVICE_URL báº¯t buá»™c khi cháº¡y review-service (khÃ´ng silent fallback InMemory)',
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
    'MEDIA_SERVICE_URL báº¯t buá»™c khi cháº¡y review-service (khÃ´ng silent fallback InMemory)',
  );
}

@Module({
  controllers: [
    ReviewsController,
    ProductsReviewsController,
    AdminReviewController,
  ],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createOrderClientProvider(),
    createCatalogClientProvider(),
    createMediaClientProvider(),
    {
      provide: ReviewService,
      useFactory: (
        repository: ReviewRepository,
        orderClient: OrderClient,
        catalogClient: CatalogClient,
        mediaClient: MediaClient,
        publisher: ReviewEventPublisher,
      ) =>
        new ReviewService(
          repository,
          orderClient,
          catalogClient,
          mediaClient,
          publisher,
        ),
      inject: [
        REVIEW_REPOSITORY,
        ORDER_CLIENT,
        CATALOG_CLIENT,
        MEDIA_CLIENT,
        REVIEW_EVENT_PUBLISHER,
      ],
    },
    {
      provide: OutboxDispatcher,
      useFactory: (
        repository: ReviewRepository,
        publisher: ReviewEventPublisher,
      ) => new OutboxDispatcher(repository, publisher),
      inject: [REVIEW_REPOSITORY, REVIEW_EVENT_PUBLISHER],
    },
  ],
})
export class ReviewModule {}
