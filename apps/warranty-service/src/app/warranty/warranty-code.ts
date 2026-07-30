import { randomInt } from 'node:crypto';

/**
 * Bảng ký tự Crockford Base32 (loại bỏ I, L, O, U để tránh nhầm lẫn khi đọc).
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function datePart(now: Date): string {
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
}

function suffix(): string {
  let out = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/** Sinh mã yêu cầu bảo hành dạng NT-W-YYYYMMDD-XXXXXX */
export function generateClaimCode(now: Date = new Date()): string {
  return `NT-W-${datePart(now)}-${suffix()}`;
}

/** Sinh mã yêu cầu đổi trả dạng NT-R-YYYYMMDD-XXXXXX */
export function generateReturnCode(now: Date = new Date()): string {
  return `NT-R-${datePart(now)}-${suffix()}`;
}

const CLAIM_CODE_PATTERN = new RegExp(
  `^NT-W-\\d{8}-[${ALPHABET}]{${SUFFIX_LENGTH}}$`,
);
const RETURN_CODE_PATTERN = new RegExp(
  `^NT-R-\\d{8}-[${ALPHABET}]{${SUFFIX_LENGTH}}$`,
);

export function isValidClaimCode(code: string): boolean {
  return CLAIM_CODE_PATTERN.test(code);
}

export function isValidReturnCode(code: string): boolean {
  return RETURN_CODE_PATTERN.test(code);
}
