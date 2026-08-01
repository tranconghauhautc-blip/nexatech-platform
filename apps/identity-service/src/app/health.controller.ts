import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Query,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHealthResponse } from '@nexatech/shared-contracts';
import {
  acceptArtifactIntegrity,
  acceptDangerousContentType,
  acceptUnsignedJwt,
  allowCredentialsInQuery,
  allowEmailVerifyBypass,
  buildOAuthRedirectWithToken,
  exposeApiInventory,
  exposeErrorStack,
  isSecurityLabEnabled,
  LAB_MARKER_BODY,
  LAB_MARKER_PATH,
  reflectRequestHeaders,
  resolveOutboundUrl,
  sessionCookieOptions,
  sha256Hex,
  shapeErrorDetails,
  shouldExposeDebugEndpoint,
  shouldExposeDeprecatedApi,
} from '@nexatech/shared-security-lab';
import { AuthService } from './auth/auth.service';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly authService: AuthService) {}

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
      routes: exposeApiInventory(),
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

  /** SC-83 — reflect request headers (log injection / XSS vector) */
  @Get('lab/reflect-headers')
  reflectHeaders(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return reflectRequestHeaders({ headers });
  }

  /** SC-86 — credentials in GET query */
  @Get('lab/login-get')
  async loginGet(
    @Query('email') email?: string,
    @Query('password') password?: string,
  ) {
    if (!allowCredentialsInQuery()) {
      throw new NotFoundException();
    }
    try {
      const tokens = await this.authService.login({
        email: email ?? '',
        password: password ?? '',
      });
      return { ok: true, ...tokens, note: 'SC-86 credentials via GET query' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** SC-88 — raw exception stack */
  @Get('lab/error-stack')
  errorStack() {
    return {
      ok: false,
      details: exposeErrorStack({
        error: new Error('lab intentional stack leak'),
      }),
    };
  }

  /** SC-90 — shadow OpenAPI / API inventory */
  @Get('lab/api-inventory')
  apiInventory() {
    return {
      deprecated: true,
      routes: exposeApiInventory(),
      docsJson: '/docs-json',
    };
  }

  /** SC-91 — insecure Set-Cookie */
  @Get('lab/set-cookie')
  setCookie(@Res({ passthrough: true }) res: Response) {
    const flags = sessionCookieOptions();
    const parts = [
      'nexatech_lab_session=lab-insecure-value',
      'Path=/',
      flags.httpOnly ? 'HttpOnly' : '',
      flags.secure ? 'Secure' : '',
      flags.sameSite ? `SameSite=${flags.sameSite}` : '',
    ].filter(Boolean);
    res.setHeader('Set-Cookie', parts.join('; '));
    return { ok: true, cookieFlags: flags, note: 'SC-91 insecure Set-Cookie' };
  }

  /** SC-92 — email verify without OTP */
  @Get('lab/verify-bypass')
  verifyBypass(@Query('email') email?: string) {
    if (!allowEmailVerifyBypass()) {
      throw new NotFoundException();
    }
    return this.authService.verifyEmailBypass(email ?? '');
  }

  /** SC-93 — token in Location redirect */
  @Get('lab/oauth-callback')
  oauthCallback(
    @Query('token') token: string | undefined,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ) {
    const location = buildOAuthRedirectWithToken({
      nextUrl: next && next.length > 0 ? next : 'https://evil.example/cb',
      accessToken: token && token.length > 0 ? token : 'lab-leaked-token',
    });
    res.setHeader('Location', location);
    res.status(302).json({ redirectedTo: location, note: 'SC-93' });
  }

  /** SC-94 — accept dangerous content types */
  @Get('lab/content-type')
  contentType(@Query('type') type?: string) {
    const contentType = type ?? 'image/svg+xml';
    return {
      contentType,
      accepted: acceptDangerousContentType({ contentType }),
      note: 'SC-94 dangerous content-type accepted',
    };
  }
}
