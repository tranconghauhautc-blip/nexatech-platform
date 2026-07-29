import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CartModule],
  controllers: [HealthController],
})
export class AppModule {}
