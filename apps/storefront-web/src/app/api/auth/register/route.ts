import { NextResponse } from 'next/server';
import { registerRequestSchema } from '@nexatech/shared-contracts';
import { ApiError } from '@nexatech/shared-web';
import { serverApiRequest } from '../../../../lib/api-server';
import { jsonError } from '../../../../lib/http-errors';
import { decodeJwtPayload } from '../../../../lib/jwt';
import { setSession } from '../../../../lib/session';

interface LoginResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError('VALIDATION_FAILED', 'Dữ liệu đăng ký không hợp lệ', 400);
  }

  const parsed = registerRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_FAILED',
      'Thông tin đăng ký không hợp lệ',
      400,
      {
        issues: parsed.error.issues,
      },
    );
  }

  try {
    await serverApiRequest('identity', '/auth/register', {
      method: 'POST',
      body: parsed.data,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.toEnvelope(), {
        status: error.httpStatus || 400,
      });
    }
    return jsonError(
      'INTERNAL_ERROR',
      'Không thể đăng ký, vui lòng thử lại',
      500,
    );
  }

  // Backend hiện chưa xác minh email tự động — thử đăng nhập ngay để tạo phiên,
  // nếu backend yêu cầu xác minh trước thì trả về trạng thái chờ xác minh.
  try {
    const loginResult = await serverApiRequest<LoginResult>(
      'identity',
      '/auth/login',
      {
        method: 'POST',
        body: { email: parsed.data.email, password: parsed.data.password },
      },
    );
    const claims = decodeJwtPayload(loginResult.accessToken);
    const roles = Array.isArray(claims?.['roles'])
      ? (claims!['roles'] as string[])
      : [];

    await setSession({
      userId: loginResult.userId,
      roles,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
    });

    return NextResponse.json(
      {
        user: {
          userId: loginResult.userId,
          email: parsed.data.email,
          fullName: parsed.data.fullName,
          roles,
        },
        requiresEmailVerification: false,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { user: null, requiresEmailVerification: true },
      { status: 201 },
    );
  }
}
