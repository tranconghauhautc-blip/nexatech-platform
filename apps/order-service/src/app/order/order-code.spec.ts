import { generateOrderCode, isValidOrderCode } from './order-code';

describe('order-code', () => {
  it('generates codes in the NT-YYYYMMDD-XXXXXX format', () => {
    const now = new Date('2026-07-30T10:00:00.000Z');
    const code = generateOrderCode(now);
    expect(code).toMatch(/^NT-20260730-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(isValidOrderCode(code)).toBe(true);
  });

  it('generates unique codes across many calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      codes.add(generateOrderCode());
    }
    // Extremely unlikely to collide across 5000 draws from a 32^6 space.
    expect(codes.size).toBe(5000);
  });

  it('rejects invalid formats', () => {
    expect(isValidOrderCode('NT-20260730-ABCDEF')).toBe(true);
    expect(isValidOrderCode('nt-20260730-abcdef')).toBe(false);
    expect(isValidOrderCode('NT-2026073-ABCDEF')).toBe(false);
    expect(isValidOrderCode('NT-20260730-ABCDE')).toBe(false);
    expect(isValidOrderCode('NT-20260730-ABCDEI')).toBe(false);
    expect(isValidOrderCode('random-string')).toBe(false);
  });
});
