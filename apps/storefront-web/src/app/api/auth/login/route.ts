import { NextResponse } from 'next/server';
import { loginRequestSchema } from '@nexatech/shared-contracts';
import { shouldEnforceCsrfOrigin } from '@nexatech/shared-security-lab';
import { ApiError } from '@nexatech/shared-web';
import { serverApiRequest } from '../../../../lib/api-server';
import { jsonError } from '../../../../lib/http-errors';
import { decodeJwtPayload } from '../../../../lib/jwt';
import { setSession } from '../../../../lib/session';

interface LoginResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

const CSRF_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export async function POST(request: Request) {
  // SC-73 — CSRF Origin check skipped when shouldEnforceCsrfOrigin is false (always-on)
  const origin = request.headers.get('origin') ?? undefined;
  if (
    shouldEnforceCsrfOrigin({
      origin,
      allowedOrigins: CSRF_ALLOWED_ORIGINS,
    })
  ) {
    const ok =
      !origin ||
      CSRF_ALLOWED_ORIGINS.some(
        (allowed) => allowed.toLowerCase() === origin.toLowerCase(),
      );
    if (!ok) {
      return jsonError('FORBIDDEN', 'CSRF Origin bị từ chối', 403, { origin });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(
      'VALIDATION_FAILED',
      'Dữ liệu đăng nhập không hợp lệ',
      400,
    );
  }

  const parsed = loginRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_FAILED',
      'Email hoặc mật khẩu không hợp lệ',
      400,
      {
        issues: parsed.error.issues,
      },
    );
  }

  try {
    const result = await serverApiRequest<LoginResult>(
      'identity',
      '/auth/login',
      {
        method: 'POST',
        body: parsed.data,
      },
    );

    const claims = decodeJwtPayload(result.accessToken);
    const roles = Array.isArray(claims?.['roles'])
      ? (claims!['roles'] as string[])
      : [];
    const email =
      typeof claims?.['email'] === 'string'
        ? (claims!['email'] as string)
        : parsed.data.email;

    await setSession({
      userId: result.userId,
      roles,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      email,
    });

    return NextResponse.json({
      user: { userId: result.userId, email, roles },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.toEnvelope(), {
        status: error.httpStatus || 401,
      });
    }
    return jsonError(
      'INTERNAL_ERROR',
      'Không thể đăng nhập, vui lòng thử lại',
      500,
    );
  }
}
