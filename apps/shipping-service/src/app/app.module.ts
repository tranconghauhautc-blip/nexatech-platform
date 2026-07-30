import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ShippingModule } from './shipping/shipping.module';

@Module({
  imports: [ShippingModule],
  controllers: [HealthController],
})
export class AppModule {}
