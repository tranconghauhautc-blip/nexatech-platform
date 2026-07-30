import {
  Controller,
  Get,
  NotFoundException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';
import {
  isSecurityLabEnabled,
  LAB_MARKER_BODY,
  LAB_MARKER_PATH,
} from '@nexatech/shared-security-lab';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  @Get('health')
  health() {
    return createHealthResponse('identity-service');
  }

  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  ready() {
    return { status: 'ok' };
  }

  /** Lab marker — only present when security-lab deploy profile is active. */
  @Get('health/lab')
  labMarker() {
    if (!isSecurityLabEnabled()) {
      throw new NotFoundException();
    }
    return {
      ...LAB_MARKER_BODY,
      path: LAB_MARKER_PATH,
      service: 'identity-service',
    };
  }
}
