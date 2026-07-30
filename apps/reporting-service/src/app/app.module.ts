import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [ReportingModule],
  controllers: [HealthController],
})
export class AppModule {}
