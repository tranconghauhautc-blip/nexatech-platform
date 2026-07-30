import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  @Get('health')
  health() {
    return createHealthResponse('cart-service');
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
