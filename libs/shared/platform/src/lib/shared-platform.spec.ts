import {
  API_VERSIONS,
  CORRELATION_HEADERS,
  PLATFORM_NAME,
  assertDefined,
  createId,
  createRequestId,
  createTraceId,
  isNonEmptyString,
  normalizePage,
  normalizePageSize,
} from './shared-platform';

describe('shared-platform', () => {
  it('exposes platform constants', () => {
    expect(PLATFORM_NAME).toBe('NexaTech');
    expect(API_VERSIONS).toEqual(['v1', 'v2']);
    expect(CORRELATION_HEADERS.requestId).toBe('x-request-id');
    expect(CORRELATION_HEADERS.traceId).toBe('x-trace-id');
  });

  it('creates unique identifiers', () => {
    const a = createId();
    const b = createTraceId();
    const c = createRequestId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(b).not.toEqual(a);
    expect(c).not.toEqual(b);
  });

  it('assertDefined returns value or throws', () => {
    expect(assertDefined('ok')).toBe('ok');
    expect(() => assertDefined(undefined)).toThrow('Giá trị bắt buộc bị thiếu');
  });

  it('validates non-empty strings', () => {
    expect(isNonEmptyString('abc')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString(1)).toBe(false);
  });

  it('normalizes pagination', () => {
    expect(normalizePage()).toBe(1);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(3.9)).toBe(3);
    expect(normalizePageSize()).toBe(20);
    expect(normalizePageSize(500)).toBe(100);
    expect(normalizePageSize(10, { defaultSize: 25, maxSize: 50 })).toBe(10);
  });
});
