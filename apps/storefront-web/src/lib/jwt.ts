/**
 * Giải mã payload JWT mà KHÔNG xác thực chữ ký — chỉ dùng để đọc claim tiện lợi
 * (vd. `roles`, `sessionId`) ở BFF, vì việc xác thực thật sự do backend đảm nhận.
 * Không dùng kết quả này cho quyết định phân quyền nhạy cảm phía server khác.
 */
export interface JwtPayload {
  sub?: string;
  email?: string;
  roles?: string[];
  sessionId?: string;
  sid?: string;
  typ?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  return atob(padded);
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
