import type { Role } from '@nexatech/shared-auth';

export const ADMIN_SESSION_COOKIE = 'nexatech_admin_session';

/** Thời hạn phiên đăng nhập admin trên trình duyệt (giây). Độc lập với TTL JWT backend. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface AdminSessionPayload {
  userId: string;
  email: string;
  roles: Role[];
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  issuedAt: number;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET (hoặc JWT_ACCESS_SECRET) chưa được cấu hình hợp lệ (>=16 ký tự)',
    );
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  if (typeof atob === 'function') {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signPayload(
  payloadB64: string,
  secret: string,
): Promise<string> {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** Ký một phiên admin thành chuỗi cookie `payload.signature` (base64url). */
export async function createSessionToken(
  payload: AdminSessionPayload,
  secret: string = getSessionSecret(),
): Promise<string> {
  const payloadB64 = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await signPayload(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/** Xác thực chữ ký + hạn dùng của token phiên admin. Trả về `null` nếu không hợp lệ. */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string = getSessionSecret(),
): Promise<AdminSessionPayload | null> {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64, signature] = parts;
  try {
    const expectedSignature = await signPayload(payloadB64, secret);
    if (!timingSafeEqual(expectedSignature, signature)) {
      return null;
    }
    const json = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(json) as AdminSessionPayload;
    if (
      !payload.userId ||
      !Array.isArray(payload.roles) ||
      !payload.sessionId
    ) {
      return null;
    }
    if (
      typeof payload.expiresAt === 'number' &&
      Date.now() > payload.expiresAt
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
