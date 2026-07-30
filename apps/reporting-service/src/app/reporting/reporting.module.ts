import { Module } from '@nestjs/common';
import { AdminReportingController } from './admin-reporting.controller';
import { EventConsumer } from './event-consumer';
import { ReportingService } from './reporting.service';
import {
  InMemoryReportingRepository,
  REPORTING_REPOSITORY,
  type ReportingRepository,
} from './reporting.repository';
import { PrismaReportingRepository } from './prisma-reporting.repository';
import { PrismaService } from './prisma.service';

function createRepositoryProvider() {
  const dbUrl =
    process.env['REPORTING_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: REPORTING_REPOSITORY,
        useFactory: (prisma: PrismaService): ReportingRepository =>
          new PrismaReportingRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: REPORTING_REPOSITORY,
        useClass: InMemoryReportingRepository,
      },
    ];
  }
  throw new Error(
    'REPORTING_DATABASE_URL bắt buộc khi chạy reporting-service (trừ NODE_ENV=test)',
  );
}

@Module({
  controllers: [AdminReportingController],
  providers: [
    ...createRepositoryProvider(),
    {
      provide: ReportingService,
      useFactory: (repository: ReportingRepository) =>
        new ReportingService(repository),
      inject: [REPORTING_REPOSITORY],
    },
    {
      provide: EventConsumer,
      useFactory: (service: ReportingService) => new EventConsumer(service),
      inject: [ReportingService],
    },
  ],
})
export class ReportingModule {}
