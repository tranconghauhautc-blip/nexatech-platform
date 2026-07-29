import { Module } from '@nestjs/common';
import { InMemoryObjectStorage } from './in-memory.object-storage';
import { MediaController } from './media.controller';
import {
  InMemoryMediaRepository,
  MEDIA_REPOSITORY,
  type MediaRepository,
} from './media.repository';
import { MediaService } from './media.service';
import { MinioObjectStorage } from './minio.object-storage';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage';
import { PrismaMediaRepository } from './prisma-media.repository';
import { PrismaService } from './prisma.service';

function createRepositoryProvider() {
  const dbUrl = process.env['MEDIA_DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: MEDIA_REPOSITORY,
        useFactory: (prisma: PrismaService): MediaRepository =>
          new PrismaMediaRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: MEDIA_REPOSITORY,
        useClass: InMemoryMediaRepository,
      },
    ];
  }
  throw new Error(
    'MEDIA_DATABASE_URL bắt buộc khi chạy media-service (trừ NODE_ENV=test)',
  );
}

function createStorageProvider() {
  const accessKey = process.env['MINIO_ACCESS_KEY'];
  if (accessKey) {
    return {
      provide: OBJECT_STORAGE,
      useFactory: (): ObjectStorage => new MinioObjectStorage(),
    };
  }
  if (process.env['NODE_ENV'] === 'test') {
    return {
      provide: OBJECT_STORAGE,
      useClass: InMemoryObjectStorage,
    };
  }
  throw new Error(
    'MINIO_ACCESS_KEY bắt buộc khi chạy media-service (trừ NODE_ENV=test)',
  );
}

@Module({
  controllers: [MediaController],
  providers: [
    ...createRepositoryProvider(),
    createStorageProvider(),
    {
      provide: MediaService,
      useFactory: (repository: MediaRepository, storage: ObjectStorage) =>
        new MediaService(repository, storage),
      inject: [MEDIA_REPOSITORY, OBJECT_STORAGE],
    },
  ],
})
export class MediaModule {}
