import { NextResponse } from 'next/server';
import { canAccessAdminPortal } from '@nexatech/shared-auth';
import { resolveServiceBaseUrl } from '../../../../lib/service-urls';
import {
  decodeJwtPayloadUnsafe,
  type AccessTokenClaims,
} from '../../../../lib/jwt';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '../../../../lib/session';
import { loginFormSchema } from '../../../../lib/validation/auth';

interface IdentityLoginResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

function errorResponse(status: number, errorCode: string, message: string) {
  return NextResponse.json(
    {
      errorCode,
      message,
      traceId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      'BFF_INVALID_BODY',
      'Nội dung yêu cầu không hợp lệ',
    );
  }

  const parsed = loginFormSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      'BFF_VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
    );
  }

  const baseUrl = resolveServiceBaseUrl('identity');
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return errorResponse(
      502,
      'BFF_UPSTREAM_UNAVAILABLE',
      'Không thể kết nối máy chủ xác thực. Vui lòng thử lại sau.',
    );
  }

  const text = await upstreamResponse.text();
  let payload: unknown;
  try {
    payload = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!upstreamResponse.ok) {
    const envelope = payload as
      | { errorCode?: string; message?: string }
      | undefined;
    return errorResponse(
      upstreamResponse.status,
      envelope?.errorCode ?? 'BFF_LOGIN_FAILED',
      envelope?.message ?? 'Đăng nhập thất bại',
    );
  }

  const loginResult = payload as IdentityLoginResponse;
  const claims = decodeJwtPayloadUnsafe<AccessTokenClaims>(
    loginResult.accessToken,
  );
  if (!claims) {
    return errorResponse(
      502,
      'BFF_INVALID_TOKEN',
      'Không đọc được thông tin phiên đăng nhập',
    );
  }

  if (!canAccessAdminPortal(claims.roles)) {
    return errorResponse(
      403,
      'BFF_FORBIDDEN_PORTAL',
      'Tài khoản của bạn không có quyền truy cập trang quản trị NexaTech',
    );
  }

  const now = Date.now();
  const sessionToken = await createSessionToken({
    userId: claims.sub,
    email: claims.email,
    roles: claims.roles,
    sessionId: claims.sessionId,
    accessToken: loginResult.accessToken,
    refreshToken: loginResult.refreshToken,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  const response = NextResponse.json({
    userId: claims.sub,
    email: claims.email,
    roles: claims.roles,
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
