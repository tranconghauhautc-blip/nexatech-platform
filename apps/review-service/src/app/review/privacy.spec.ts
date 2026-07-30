import { maskDisplayName, sanitizeText } from './privacy';

describe('privacy helpers', () => {
  it('sanitizes angle brackets', () => {
    expect(sanitizeText('Hello <script>alert(1)</script>')).toBe(
      'Hello scriptalert(1)/script',
    );
  });

  it('masks display names and emails', () => {
    expect(maskDisplayName('Nguyễn Văn A')).toBe('Nguyễn ***');
    expect(maskDisplayName('user@example.com')).toMatch(/\*\*\*$/);
    expect(maskDisplayName('')).toBe('Khách hàng NexaTech');
  });
});
