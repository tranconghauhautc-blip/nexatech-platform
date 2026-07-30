import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'nt_session';
export const CART_TOKEN_COOKIE = 'nt_cart_token';

export interface SessionData {
  userId: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  email?: string;
  fullName?: string;
  sessionExpiresAt?: number;
}

const isProd = process.env['NODE_ENV'] === 'production';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CART_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed.userId || !parsed.accessToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_TOKEN_COOKIE)?.value ?? null;
}

export async function setCartToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function clearCartToken(): Promise<void> {
  const store = await cookies();
  store.delete(CART_TOKEN_COOKIE);
}

export function rolesHeaderValue(roles: string[] | undefined): string {
  return (roles ?? []).filter(Boolean).join(',');
}

/** Vai trò tối thiểu coi là "đã đăng nhập" tài khoản nhân viên (chưa dùng ở storefront). */
export const STAFF_ROLES = ['Staff', 'Manager', 'Admin', 'SuperAdmin'];
