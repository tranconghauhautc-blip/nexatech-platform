import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OrderModule } from './order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [HealthController],
})
export class AppModule {}
