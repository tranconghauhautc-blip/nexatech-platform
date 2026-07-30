import {
  acceptPaymentAmount,
  acceptWebhookSignature,
  allowMediaAccess,
  buildIdempotencyScope,
  clampPageSize,
  enforceAdminFunction,
  enforceResourceOwnership,
  filterMassAssignment,
  issueVerificationToken,
  resolveCorsOrigin,
  resolveTrustedAmount,
  sessionCookieOptions,
  shapePublicResource,
  shouldEnforceBffPathSanitize,
  shouldRateLimitAuth,
  shouldRejectDuplicateCallback,
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

  it('SC-12 amount manipulation only in lab', () => {
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

  it('SC-18/20 webhook signature + amount', () => {
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

  it('SC-17 duplicate callback', () => {
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

  it('SC-28 insecure cookies in lab', () => {
    expect(sessionCookieOptions(secureEnv).httpOnly).toBe(true);
    expect(sessionCookieOptions(labEnv).httpOnly).toBe(false);
  });

  it('SC-30 insecure CORS in lab', () => {
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
});
