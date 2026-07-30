import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { WarrantyModule } from './warranty/warranty.module';

@Module({
  imports: [WarrantyModule],
  controllers: [HealthController],
})
export class AppModule {}
