import {
  Controller,
  Get,
  NotFoundException,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';
import {
  isSecurityLabEnabled,
  LAB_MARKER_BODY,
  LAB_MARKER_PATH,
  resolveOutboundUrl,
  shapeErrorDetails,
  shouldExposeDebugEndpoint,
  shouldExposeDeprecatedApi,
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

  /**
   * SC-60 / API9 — deprecated unversioned inventory (lab-only exposure).
   * Production: 404. Lab: lists hidden/admin routes for inventory mismanagement PoC.
   */
  @Get('api/v0/internal/routes')
  deprecatedApiInventory() {
    if (!shouldExposeDeprecatedApi()) {
      throw new NotFoundException();
    }
    return {
      deprecated: true,
      warning: 'lab-only shadow inventory',
      routes: [
        '/api/v0/internal/routes',
        '/health/debug',
        '/api/v1/admin/users',
        '/api/v1/payments/internal',
      ],
    };
  }

  /**
   * SC-67 / API8 + SC-65 / A10 — debug endpoint + exceptional error leakage (lab-only).
   */
  @Get('health/debug')
  debugEndpoint(@Query('fail') fail?: string) {
    if (!shouldExposeDebugEndpoint()) {
      throw new NotFoundException();
    }
    if (fail === '1') {
      const error = new Error('lab simulated dependency failure');
      return {
        ok: false,
        details: shapeErrorDetails({
          secureDetails: { name: error.name },
          error,
          internalUrl: 'redis://lab-redis:6379/0',
        }),
      };
    }
    return {
      ok: true,
      env: {
        deployProfile: process.env['NEXATECH_DEPLOY_PROFILE'],
        securityLab: process.env['NEXATECH_SECURITY_LAB'],
      },
      configDump: {
        jwtHint: 'lab-debug-exposure',
      },
    };
  }

  /**
   * SC-59 / API7 — SSRF URL resolution probe (does not fetch; returns policy decision).
   */
  @Get('lab/ssrf-probe')
  ssrfProbe(@Query('url') url?: string) {
    if (!isSecurityLabEnabled()) {
      throw new NotFoundException();
    }
    const requestedUrl = url ?? '';
    const result = resolveOutboundUrl({
      requestedUrl,
      allowlistHosts: ['cdn.nexatech.local', 'media.nexatech.local'],
    });
    return { requestedUrl, result };
  }
}
