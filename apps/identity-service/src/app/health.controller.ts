import {
  Controller,
  Get,
  NotFoundException,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { createHealthResponse } from '@nexatech/shared-contracts';
import {
  acceptArtifactIntegrity,
  acceptUnsignedJwt,
  isSecurityLabEnabled,
  LAB_MARKER_BODY,
  LAB_MARKER_PATH,
  resolveOutboundUrl,
  sha256Hex,
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

  @Get('health/lab')
  labMarker() {
    return {
      ...LAB_MARKER_BODY,
      path: LAB_MARKER_PATH,
      service: 'identity-service',
      alwaysOn: isSecurityLabEnabled(),
    };
  }

  @Get('api/v0/internal/routes')
  deprecatedApiInventory() {
    if (!shouldExposeDeprecatedApi()) {
      throw new NotFoundException();
    }
    return {
      deprecated: true,
      warning: 'always-on shadow inventory for WAF PoC',
      routes: [
        '/api/v0/internal/routes',
        '/health/debug',
        '/api/v1/admin/users',
        '/api/v1/payments/internal',
        '/lab/ssrf-probe',
        '/lab/supply-chain',
        '/lab/jwt-alg-none',
      ],
    };
  }

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
        jwtHint: 'always-on-debug-exposure',
        jwtAccessSecretHint: (
          process.env['JWT_ACCESS_SECRET'] ?? 'dev-access-secret'
        ).slice(0, 8),
      },
    };
  }

  /**
   * SC-59 — real SSRF fetch (timeout + size capped) for WAF detection PoC.
   */
  @Get('lab/ssrf-probe')
  async ssrfProbe(@Query('url') url?: string) {
    const requestedUrl = url ?? '';
    const result = resolveOutboundUrl({
      requestedUrl,
      allowlistHosts: ['cdn.nexatech.local', 'media.nexatech.local'],
    });
    if (!result.ok) {
      return { requestedUrl, result, fetched: false };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(result.url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = (await res.text()).slice(0, 512);
      return {
        requestedUrl,
        result,
        fetched: true,
        status: res.status,
        bodyPreview: text,
      };
    } catch (error) {
      return {
        requestedUrl,
        result,
        fetched: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** SC-62 — accept bad artifact checksum */
  @Get('lab/supply-chain')
  supplyChain(@Query('digest') digest?: string) {
    const content = 'nexatech-lab-artifact-v1';
    const expected = sha256Hex(content);
    const provided = digest ?? 'deadbeef';
    const accepted = acceptArtifactIntegrity({
      checksumValid: provided === expected,
    });
    return { expected, provided, accepted };
  }

  /** SC-70 — advertise alg=none acceptance + sample forged token for /auth/me */
  @Get('lab/jwt-alg-none')
  jwtAlgNone(@Query('sub') sub?: string) {
    const subject = (sub ?? 'REPLACE_WITH_VICTIM_USER_ID').trim();
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: subject,
        typ: 'access',
        email: 'forged@evil.example',
        roles: ['SuperAdmin'],
      }),
    ).toString('base64url');
    const sampleUnsignedJwt = `${header}.${payload}.`;
    return {
      acceptUnsignedJwt: acceptUnsignedJwt(),
      sampleUnsignedJwt,
      attack: {
        method: 'GET',
        path: '/api/v1/auth/me',
        header: `Authorization: Bearer ${sampleUnsignedJwt}`,
      },
      note: 'GET /api/v1/auth/me accepts alg=none JWT (SC-70 always-on). Replace sub with a real user id.',
    };
  }
}
