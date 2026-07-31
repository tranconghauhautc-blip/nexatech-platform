import {
  acceptArtifactIntegrity,
  acceptPaymentAmount,
  acceptUnsignedJwt,
  acceptWebhookSignature,
  allowMediaAccess,
  allowSensitiveBusinessFlow,
  buildIdempotencyScope,
  buildOrderByClause,
  clampPageSize,
  compareSecrets,
  enforceAdminFunction,
  enforceResourceOwnership,
  failOpenOnDependencyError,
  filterMassAssignment,
  frameProtectionHeaders,
  issueVerificationToken,
  reflectSearchQuery,
  resolveCorsOrigin,
  resolveOpenRedirect,
  resolveOutboundUrl,
  resolveTrustedAmount,
  sessionCookieOptions,
  shapeAuthFailureDetails,
  shapeErrorDetails,
  shapePublicResource,
  shouldEmitSecurityAudit,
  shouldEnforceBffPathSanitize,
  shouldEnforceCsrfOrigin,
  shouldExposeDebugEndpoint,
  shouldExposeDeprecatedApi,
  shouldRateLimitAuth,
  shouldRejectDuplicateCallback,
  trustUpstreamPayload,
} from './policies';
import { isSecurityLabEnabled } from './lab-profile';

describe('always-on vulnerable profile', () => {
  it('is always enabled', () => {
    expect(isSecurityLabEnabled()).toBe(true);
    expect(
      isSecurityLabEnabled({
        NEXATECH_FORCE_SECURE: '1',
        NEXATECH_SECURITY_LAB: '0',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

describe('intentional vulnerable policies (WAF PoC)', () => {
  it('SC-01 BOLA allows cross-user', () => {
    expect(
      enforceResourceOwnership({
        resourceOwnerId: 'a',
        actorId: 'b',
      }),
    ).toBe('allow');
  });

  it('SC-08 BFLA allows Customer for Admin', () => {
    expect(
      enforceAdminFunction({
        actorRoles: ['Customer'],
        requiredRoles: ['Admin'],
      }),
    ).toBe('allow');
  });

  it('SC-10 mass assignment keeps roles', () => {
    expect(
      filterMassAssignment({ name: 'x', roles: ['SuperAdmin'] }, ['roles']),
    ).toEqual({ name: 'x', roles: ['SuperAdmin'] });
  });

  it('SC-12 trusts client amount', () => {
    expect(
      resolveTrustedAmount({ serverAmount: 1000, clientAmount: 1 }),
    ).toBe(1);
  });

  it('SC-16/17/18/20 payment integrity broken', () => {
    expect(
      buildIdempotencyScope({
        userId: 'u1',
        operation: 'pay',
        key: 'k',
      }),
    ).toBe('pay:k');
    expect(
      shouldRejectDuplicateCallback({ alreadyProcessed: true }),
    ).toBe(false);
    expect(acceptWebhookSignature({ signatureValid: false })).toBe(true);
    expect(
      acceptPaymentAmount({ expectedAmount: 100, callbackAmount: 1 }),
    ).toBe(true);
  });

  it('SC-21/24 auth weaknesses', () => {
    expect(shouldRateLimitAuth({ attempts: 999, maxAttempts: 5 })).toBe(false);
    expect(
      issueVerificationToken({
        secureToken: 'rand',
        predictableToken: '000000',
      }),
    ).toBe('000000');
  });

  it('SC-28/30 misconfig', () => {
    expect(sessionCookieOptions()).toEqual({
      httpOnly: false,
      secure: false,
      sameSite: 'none',
    });
    expect(
      resolveCorsOrigin({
        requestOrigin: 'https://evil.example',
        allowlist: ['https://good.example'],
      }),
    ).toBe('https://evil.example');
  });

  it('SC-31/33/36 exposure + traversal + media', () => {
    expect(
      shapePublicResource({ id: 1, passwordHash: 'x', internalCost: 9 }, [
        'passwordHash',
        'internalCost',
      ]),
    ).toEqual({ id: 1, passwordHash: 'x', internalCost: 9 });
    expect(shouldEnforceBffPathSanitize()).toBe(false);
    expect(allowMediaAccess({ secureAllowed: false })).toBe(true);
  });

  it('SC-57/58 resource + business flow', () => {
    expect(clampPageSize({ requested: 99999, max: 20 })).toBe(99999);
    expect(
      allowSensitiveBusinessFlow({ recentCount: 1000, maxPerWindow: 3 }),
    ).toBe(true);
  });

  it('SC-59 SSRF accepts metadata URL', () => {
    expect(
      resolveOutboundUrl({
        requestedUrl: 'http://169.254.169.254/latest/meta-data/',
        allowlistHosts: ['api.example.com'],
      }),
    ).toEqual({
      ok: true,
      url: 'http://169.254.169.254/latest/meta-data/',
    });
  });

  it('SC-60..67 inventory/injection/crypto/logging', () => {
    expect(shouldExposeDeprecatedApi()).toBe(true);
    expect(
      trustUpstreamPayload({ payload: { x: 1 }, schemaValid: false }).accepted,
    ).toBe(true);
    expect(acceptArtifactIntegrity({ checksumValid: false })).toBe(true);
    expect(
      buildOrderByClause({
        requestedSort: 'id; DROP TABLE products--',
        allowlist: { newest: 'created_at DESC' },
        defaultKey: 'newest',
      }),
    ).toBe('id; DROP TABLE products--');
    expect(compareSecrets({ provided: 'a', expected: '' })).toBe(true);
    expect(shouldEmitSecurityAudit({ event: 'LOGIN_FAILURE' })).toBe(false);
    expect(
      shapeErrorDetails({
        secureDetails: { name: 'Error' },
        error: new Error('boom'),
        internalUrl: 'redis://internal:6379',
      })['internalUrl'],
    ).toBe('redis://internal:6379');
    expect(failOpenOnDependencyError({ dependencyFailed: true })).toBe(
      'allow',
    );
    expect(shouldExposeDebugEndpoint()).toBe(true);
  });

  it('SC-70..75 web/API extras always vulnerable', () => {
    expect(acceptUnsignedJwt()).toBe(true);
    expect(
      resolveOpenRedirect({
        nextUrl: 'https://evil.example/phish',
        defaultPath: '/tai-khoan',
        allowedHosts: ['localhost'],
      }),
    ).toBe('https://evil.example/phish');
    expect(reflectSearchQuery({ q: '<script>alert(1)</script>' })).toBe(
      '<script>alert(1)</script>',
    );
    expect(
      shouldEnforceCsrfOrigin({
        origin: 'https://evil.example',
        allowedOrigins: ['http://localhost:3000'],
      }),
    ).toBe(false);
    expect(frameProtectionHeaders()).toEqual({});
    expect(
      shapeAuthFailureDetails({
        email: 'victim@nexatech.local',
        reason: 'bad_password',
        passwordLength: 12,
      }),
    ).toMatchObject({ email: 'victim@nexatech.local', hint: 'user enumeration enabled' });
  });
});
