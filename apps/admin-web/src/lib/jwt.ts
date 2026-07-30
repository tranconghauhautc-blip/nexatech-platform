import type { Role } from '@nexatech/shared-auth';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: Role[];
  sessionId: string;
  typ: 'access';
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Giải mã phần payload của JWT mà KHÔNG xác thực chữ ký.
 *
 * An toàn trong ngữ cảnh này vì token được đọc trực tiếp từ response của
 * identity-service ngay trong cùng một request BFF (không nhận token từ
 * nguồn không tin cậy bên ngoài) — BFF chỉ dùng payload để lấy `roles` hiển
 * thị UI; mọi request tới backend vẫn dựa trên header `x-user-id`/`x-user-roles`
 * do BFF tự gắn sau khi đăng nhập thành công.
 */
export function decodeJwtPayloadUnsafe<T>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
