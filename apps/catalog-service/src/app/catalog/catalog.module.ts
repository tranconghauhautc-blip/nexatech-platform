import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogController } from './catalog.controller';
import {
  CATALOG_REPOSITORY,
  InMemoryCatalogRepository,
  type CatalogRepository,
} from './catalog.repository';
import { CatalogService } from './catalog.service';
import { PrismaCatalogRepository } from './prisma-catalog.repository';
import { PrismaService } from './prisma.service';

function createRepositoryProvider() {
  const dbUrl = process.env['CATALOG_DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: CATALOG_REPOSITORY,
        useFactory: (prisma: PrismaService): CatalogRepository =>
          new PrismaCatalogRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: CATALOG_REPOSITORY,
        useClass: InMemoryCatalogRepository,
      },
    ];
  }
  throw new Error(
    'CATALOG_DATABASE_URL bắt buộc khi chạy catalog-service (trừ NODE_ENV=test)',
  );
}

@Module({
  controllers: [CatalogController, AdminCatalogController],
  providers: [
    ...createRepositoryProvider(),
    {
      provide: CatalogService,
      useFactory: (repository: CatalogRepository) =>
        new CatalogService(repository),
      inject: [CATALOG_REPOSITORY],
    },
  ],
})
export class CatalogModule {}
