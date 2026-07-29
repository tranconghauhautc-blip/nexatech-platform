import { randomInt } from 'node:crypto';

/**
 * Bảng ký tự Crockford Base32 (loại bỏ I, L, O, U để tránh nhầm lẫn khi đọc).
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6;

const ORDER_CODE_PATTERN = new RegExp(
  `^NT-\\d{8}-[${ALPHABET}]{${SUFFIX_LENGTH}}$`,
);

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Sinh mã đơn hàng dạng NT-YYYYMMDD-XXXXXX với XXXXXX là 6 ký tự
 * ngẫu nhiên an toàn theo bảng Crockford Base32.
 */
export function generateOrderCode(now: Date = new Date()): string {
  const datePart = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(
    now.getUTCDate(),
  )}`;
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `NT-${datePart}-${suffix}`;
}

export function isValidOrderCode(code: string): boolean {
  return ORDER_CODE_PATTERN.test(code);
}
