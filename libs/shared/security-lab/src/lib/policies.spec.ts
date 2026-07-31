import {
  acceptArtifactIntegrity,
  acceptPaymentAmount,
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
  issueVerificationToken,
  resolveCorsOrigin,
  resolveOutboundUrl,
  resolveTrustedAmount,
  sessionCookieOptions,
  sha256Hex,
  shapeErrorDetails,
  shapePublicResource,
  shouldEmitSecurityAudit,
  shouldEnforceBffPathSanitize,
  shouldExposeDebugEndpoint,
  shouldExposeDeprecatedApi,
  shouldRateLimitAuth,
  shouldRejectDuplicateCallback,
  trustUpstreamPayload,
} from './policies';
import { isSecurityLabEnabled } from './lab-profile';

const secureEnv = {
  NEXATECH_SECURITY_LAB: '0',
  NEXATECH_DEPLOY_PROFILE: 'production',
} as NodeJS.ProcessEnv;

const labEnv = {
  NEXATECH_SECURITY_LAB: '1',
  NEXATECH_DEPLOY_PROFILE: 'security-lab',
} as NodeJS.ProcessEnv;

describe('lab profile', () => {
  it('is disabled in production env', () => {
    expect(isSecurityLabEnabled(secureEnv)).toBe(false);
  });
  it('requires both flags for lab', () => {
    expect(
      isSecurityLabEnabled({
        NEXATECH_SECURITY_LAB: '1',
        NEXATECH_DEPLOY_PROFILE: 'production',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(isSecurityLabEnabled(labEnv)).toBe(true);
  });
});

describe('secure vs lab policies', () => {
  it('SC-01/02 ownership: deny cross-user when secure, allow when lab', () => {
    expect(
      enforceResourceOwnership({
        resourceOwnerId: 'a',
        actorId: 'b',
        env: secureEnv,
      }),
    ).toBe('deny');
    expect(
      enforceResourceOwnership({
        resourceOwnerId: 'a',
        actorId: 'b',
        env: labEnv,
      }),
    ).toBe('allow');
  });

  it('SC-08 BFLA: staff-only denied for customer when secure', () => {
    expect(
      enforceAdminFunction({
        actorRoles: ['Customer'],
        requiredRoles: ['Admin'],
        env: secureEnv,
      }),
    ).toBe('deny');
    expect(
      enforceAdminFunction({
        actorRoles: ['Customer'],
        requiredRoles: ['Admin'],
        env: labEnv,
      }),
    ).toBe('allow');
  });

  it('SC-10 mass assignment strips roles when secure', () => {
    const body = { name: 'x', roles: ['Admin'], price: 1 };
    expect(filterMassAssignment(body, ['roles', 'price'], secureEnv)).toEqual({
      name: 'x',
    });
    expect(filterMassAssignment(body, ['roles', 'price'], labEnv)).toEqual(
      body,
    );
  });

  it('SC-12 / API6 amount manipulation only in lab', () => {
    expect(
      resolveTrustedAmount({
        serverAmount: 1000,
        clientAmount: 1,
        env: secureEnv,
      }),
    ).toBe(1000);
    expect(
      resolveTrustedAmount({
        serverAmount: 1000,
        clientAmount: 1,
        env: labEnv,
      }),
    ).toBe(1);
  });

  it('SC-18 / A08 webhook signature + SC-20 / API6 amount', () => {
    expect(
      acceptWebhookSignature({ signatureValid: false, env: secureEnv }),
    ).toBe(false);
    expect(acceptWebhookSignature({ signatureValid: false, env: labEnv })).toBe(
      true,
    );
    expect(
      acceptPaymentAmount({
        expectedAmount: 100,
        callbackAmount: 1,
        env: secureEnv,
      }),
    ).toBe(false);
    expect(
      acceptPaymentAmount({
        expectedAmount: 100,
        callbackAmount: 1,
        env: labEnv,
      }),
    ).toBe(true);
  });

  it('SC-21 rate limit missing in lab', () => {
    expect(
      shouldRateLimitAuth({ attempts: 100, maxAttempts: 5, env: secureEnv }),
    ).toBe(true);
    expect(
      shouldRateLimitAuth({ attempts: 100, maxAttempts: 5, env: labEnv }),
    ).toBe(false);
  });

  it('SC-33 BFF sanitize enforced only when secure', () => {
    expect(shouldEnforceBffPathSanitize(secureEnv)).toBe(true);
    expect(shouldEnforceBffPathSanitize(labEnv)).toBe(false);
  });

  it('SC-36 media ownership', () => {
    expect(allowMediaAccess({ secureAllowed: false, env: secureEnv })).toBe(
      false,
    );
    expect(allowMediaAccess({ secureAllowed: false, env: labEnv })).toBe(true);
  });

  it('SC-31 excessive data exposure', () => {
    const r = { id: '1', internalCost: 9, name: 'p' };
    expect(shapePublicResource(r, ['internalCost'], secureEnv)).toEqual({
      id: '1',
      name: 'p',
    });
    expect(shapePublicResource(r, ['internalCost'], labEnv)).toEqual(r);
  });

  it('SC-24 predictable token in lab', () => {
    expect(
      issueVerificationToken({
        secureToken: 'abc',
        predictableToken: '0001',
        env: secureEnv,
      }),
    ).toBe('abc');
    expect(
      issueVerificationToken({
        secureToken: 'abc',
        predictableToken: '0001',
        env: labEnv,
      }),
    ).toBe('0001');
  });

  it('SC-16 idempotency scope', () => {
    expect(
      buildIdempotencyScope({
        userId: 'u1',
        operation: 'pay',
        key: 'k',
        env: secureEnv,
      }),
    ).toBe('u1:pay:k');
    expect(
      buildIdempotencyScope({
        userId: 'u1',
        operation: 'pay',
        key: 'k',
        env: labEnv,
      }),
    ).toBe('pay:k');
  });

  it('SC-17 / API6 duplicate callback', () => {
    expect(
      shouldRejectDuplicateCallback({
        alreadyProcessed: true,
        env: secureEnv,
      }),
    ).toBe(true);
    expect(
      shouldRejectDuplicateCallback({ alreadyProcessed: true, env: labEnv }),
    ).toBe(false);
  });

  it('SC-28 / A02 insecure cookies in lab', () => {
    expect(sessionCookieOptions(secureEnv).httpOnly).toBe(true);
    expect(sessionCookieOptions(labEnv).httpOnly).toBe(false);
  });

  it('SC-30 / A02 insecure CORS in lab', () => {
    expect(
      resolveCorsOrigin({
        requestOrigin: 'https://evil.example',
        allowlist: ['https://shop.local'],
        env: secureEnv,
      }),
    ).toBeUndefined();
    expect(
      resolveCorsOrigin({
        requestOrigin: 'https://evil.example',
        allowlist: ['https://shop.local'],
        env: labEnv,
      }),
    ).toBe('https://evil.example');
  });

  it('SC-57 pageSize clamp', () => {
    expect(clampPageSize({ requested: 99999, max: 100, env: secureEnv })).toBe(
      100,
    );
    expect(clampPageSize({ requested: 99999, max: 100, env: labEnv })).toBe(
      99999,
    );
  });

  it('SC-58 / API6 sensitive business flow', () => {
    expect(
      allowSensitiveBusinessFlow({
        recentCount: 99,
        maxPerWindow: 5,
        env: secureEnv,
      }),
    ).toBe(false);
    expect(
      allowSensitiveBusinessFlow({
        recentCount: 99,
        maxPerWindow: 5,
        env: labEnv,
      }),
    ).toBe(true);
  });

  it('SC-59 / API7 SSRF outbound URL', () => {
    const meta = 'http://169.254.169.254/latest/meta-data/';
    expect(
      resolveOutboundUrl({
        requestedUrl: meta,
        allowlistHosts: ['cdn.nexatech.local'],
        env: secureEnv,
      }).ok,
    ).toBe(false);
    expect(
      resolveOutboundUrl({
        requestedUrl: meta,
        allowlistHosts: ['cdn.nexatech.local'],
        env: labEnv,
      }),
    ).toEqual({ ok: true, url: meta });
    expect(
      resolveOutboundUrl({
        requestedUrl: 'https://cdn.nexatech.local/a.png',
        allowlistHosts: ['cdn.nexatech.local'],
        env: secureEnv,
      }).ok,
    ).toBe(true);
  });

  it('SC-60 / API9 deprecated API inventory', () => {
    expect(shouldExposeDeprecatedApi(secureEnv)).toBe(false);
    expect(shouldExposeDeprecatedApi(labEnv)).toBe(true);
  });

  it('SC-61 / API10 trust upstream payload', () => {
    const forged = { status: 'delivered', paid: true };
    expect(
      trustUpstreamPayload({
        payload: forged,
        schemaValid: false,
        env: secureEnv,
      }).accepted,
    ).toBe(false);
    expect(
      trustUpstreamPayload({
        payload: forged,
        schemaValid: false,
        env: labEnv,
      }).accepted,
    ).toBe(true);
  });

  it('SC-62 / A03 artifact integrity (fixture hash)', () => {
    const digest = sha256Hex('nexatech-lab-fixture-v1');
    expect(digest).toHaveLength(64);
    expect(
      acceptArtifactIntegrity({
        checksumValid: false,
        signatureValid: false,
        env: secureEnv,
      }),
    ).toBe(false);
    expect(
      acceptArtifactIntegrity({
        checksumValid: false,
        signatureValid: false,
        env: labEnv,
      }),
    ).toBe(true);
  });

  it('SC-63 / A05 ORDER BY injection channel', () => {
    const allowlist = {
      name: 'p."name" ASC',
      newest: 'p."createdAt" DESC',
    };
    expect(
      buildOrderByClause({
        requestedSort: 'name',
        allowlist,
        defaultKey: 'newest',
        env: secureEnv,
      }),
    ).toBe('p."name" ASC');
    expect(
      buildOrderByClause({
        requestedSort: 'name; DROP TABLE "Product";--',
        allowlist,
        defaultKey: 'newest',
        env: secureEnv,
      }),
    ).toBe('p."createdAt" DESC');
    expect(
      buildOrderByClause({
        requestedSort: 'name; DROP TABLE "Product";--',
        allowlist,
        defaultKey: 'newest',
        env: labEnv,
      }),
    ).toContain('DROP TABLE');
  });

  it('SC-66 / A04 weak secret compare', () => {
    expect(
      compareSecrets({
        provided: 'abc',
        expected: 'abc',
        env: secureEnv,
      }),
    ).toBe(true);
    expect(
      compareSecrets({
        provided: 'abc',
        expected: 'abd',
        env: secureEnv,
      }),
    ).toBe(false);
    expect(
      compareSecrets({
        provided: 'anything',
        expected: '',
        env: labEnv,
      }),
    ).toBe(true);
  });

  it('SC-64 / A09 suppress security audit in lab', () => {
    expect(
      shouldEmitSecurityAudit({ event: 'LOGIN_FAILURE', env: secureEnv }),
    ).toBe(true);
    expect(
      shouldEmitSecurityAudit({ event: 'LOGIN_FAILURE', env: labEnv }),
    ).toBe(false);
  });

  it('SC-65 / A10 error leakage + fail-open', () => {
    const err = new Error('boom');
    const lab = shapeErrorDetails({
      secureDetails: { name: 'Error' },
      error: err,
      internalUrl: 'http://redis:6379',
      env: labEnv,
    });
    expect(lab['stack']).toBeDefined();
    expect(lab['internalUrl']).toBe('http://redis:6379');
    expect(
      shapeErrorDetails({
        secureDetails: { name: 'Error' },
        error: err,
        internalUrl: 'http://redis:6379',
        env: secureEnv,
      }),
    ).toEqual({ name: 'Error' });
    expect(
      failOpenOnDependencyError({
        dependencyFailed: true,
        env: secureEnv,
      }),
    ).toBe('deny');
    expect(
      failOpenOnDependencyError({
        dependencyFailed: true,
        env: labEnv,
      }),
    ).toBe('allow');
  });

  it('SC-67 / API8 debug endpoint exposure', () => {
    expect(shouldExposeDebugEndpoint(secureEnv)).toBe(false);
    expect(shouldExposeDebugEndpoint(labEnv)).toBe(true);
  });
});
