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

/** Sinh mã yêu cầu hỗ trợ dạng NT-S-YYYYMMDD-XXXXXX */
export function generateTicketCode(now: Date = new Date()): string {
  return `NT-S-${datePart(now)}-${suffix()}`;
}

const TICKET_CODE_PATTERN = new RegExp(
  `^NT-S-\\d{8}-[${ALPHABET}]{${SUFFIX_LENGTH}}$`,
);

export function isValidTicketCode(code: string): boolean {
  return TICKET_CODE_PATTERN.test(code);
}
