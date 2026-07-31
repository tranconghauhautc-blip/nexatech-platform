import {
  bffTimeoutMs,
  resolveBffOutboundUrl,
  sanitizeBffPathParts,
  upstreamUnavailableEnvelope,
} from './bff-security';

describe('bff-security', () => {
  it('rejects path traversal segments', () => {
    expect(sanitizeBffPathParts(['..', 'users'])).toBeNull();
    expect(sanitizeBffPathParts(['products', '..'])).toBeNull();
    expect(sanitizeBffPathParts(['products', 'id', '.'])).toBeNull();
  });

  it('allows normal REST segments and UUID', () => {
    const parts = sanitizeBffPathParts([
      'products',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'reviews',
    ]);
    expect(parts).toEqual([
      'products',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'reviews',
    ]);
  });

  it('returns safe upstream envelope without internal URLs', () => {
    const envelope = upstreamUnavailableEnvelope('trace-1');
    expect(envelope.errorCode).toBe('UPSTREAM_UNAVAILABLE');
    expect(envelope.message).not.toMatch(/localhost|127\.0\.0\.1|http/i);
    expect(envelope.traceId).toBe('trace-1');
  });

  it('reads timeout from env with fallback', () => {
    const prev = process.env['BFF_UPSTREAM_TIMEOUT_MS'];
    process.env['BFF_UPSTREAM_TIMEOUT_MS'] = '2500';
    expect(bffTimeoutMs()).toBe(2500);
    delete process.env['BFF_UPSTREAM_TIMEOUT_MS'];
    expect(bffTimeoutMs()).toBe(15_000);
    if (prev !== undefined) {
      process.env['BFF_UPSTREAM_TIMEOUT_MS'] = prev;
    }
  });

  it('SC-59 secure mode blocks metadata SSRF URL', () => {
    const prevLab = process.env['NEXATECH_SECURITY_LAB'];
    const prevProfile = process.env['NEXATECH_DEPLOY_PROFILE'];
    process.env['NEXATECH_SECURITY_LAB'] = '0';
    process.env['NEXATECH_DEPLOY_PROFILE'] = 'production';
    expect(
      resolveBffOutboundUrl('http://169.254.169.254/latest/meta-data/').ok,
    ).toBe(false);
    if (prevLab === undefined) delete process.env['NEXATECH_SECURITY_LAB'];
    else process.env['NEXATECH_SECURITY_LAB'] = prevLab;
    if (prevProfile === undefined)
      delete process.env['NEXATECH_DEPLOY_PROFILE'];
    else process.env['NEXATECH_DEPLOY_PROFILE'] = prevProfile;
  });
});
