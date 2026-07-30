import { Controller, Get } from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return createHealthResponse('notification-service');
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
