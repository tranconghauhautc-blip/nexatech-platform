import { formatDateTimeVn, formatVnd } from './format';

describe('formatVnd', () => {
  it('formats integer VND', () => {
    expect(formatVnd(1_990_000)).toMatch(/1\.990\.000/);
    expect(formatVnd(1_990_000)).toMatch(/₫|VND|đ/i);
  });

  it('handles non-finite', () => {
    expect(formatVnd(Number.NaN)).toBe('—');
  });
});

describe('formatDateTimeVn', () => {
  it('formats ISO in Vietnam timezone', () => {
    const text = formatDateTimeVn('2026-07-30T10:00:00.000Z');
    expect(text).not.toBe('—');
    expect(text.length).toBeGreaterThan(5);
  });
});
