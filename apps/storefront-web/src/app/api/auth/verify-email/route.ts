import { NextResponse } from 'next/server';
import { ApiError } from '@nexatech/shared-web';
import { serverApiRequest } from '../../../../lib/api-server';
import { jsonError } from '../../../../lib/http-errors';
import { verifyEmailRequestSchema } from '../../../../lib/validation';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ', 400);
  }

  const parsed = verifyEmailRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_FAILED',
      'Dữ liệu xác minh email không hợp lệ',
      400,
      {
        issues: parsed.error.issues,
      },
    );
  }

  try {
    const result = await serverApiRequest('identity', '/auth/verify-email', {
      method: 'POST',
      body: parsed.data,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.toEnvelope(), {
        status: error.httpStatus || 400,
      });
    }
    return jsonError('INTERNAL_ERROR', 'Không thể xác minh email', 500);
  }
}
