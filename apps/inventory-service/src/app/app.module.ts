import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [HealthController],
})
export class AppModule {}
