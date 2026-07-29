import { Controller, Get } from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return createHealthResponse('inventory-service');
  }

  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  ready() {
    return { status: 'ok' };
  }
}
