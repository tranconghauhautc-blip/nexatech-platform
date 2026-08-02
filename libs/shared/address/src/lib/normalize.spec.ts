import { normalizeName } from './normalize';

describe('normalizeName', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalizeName('Hà Nội')).toBe('ha noi');
    expect(normalizeName('Đà Nẵng')).toBe('da nang');
    expect(normalizeName('Hồ Chí Minh')).toBe('ho chi minh');
  });

  it('collapses internal whitespace and trims', () => {
    expect(normalizeName('  Bến   Nghé  ')).toBe('ben nghe');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});
