import { Module } from '@nestjs/common';
import { CustomerModule } from './customer/customer.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CustomerModule],
  controllers: [HealthController],
})
export class AppModule {}
