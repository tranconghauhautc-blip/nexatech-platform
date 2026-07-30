import { NextResponse } from 'next/server';
import { serverApiRequest } from '../../../../lib/api-server';
import {
  clearCartToken,
  clearSession,
  getSession,
} from '../../../../lib/session';
import { decodeJwtPayload } from '../../../../lib/jwt';

export async function POST() {
  const session = await getSession();
  if (session) {
    const claims = decodeJwtPayload(session.accessToken);
    const sessionId =
      (claims?.['sessionId'] as string | undefined) ??
      (claims?.['sid'] as string | undefined);
    if (sessionId) {
      try {
        await serverApiRequest('identity', '/auth/logout', {
          method: 'POST',
          body: { sessionId },
        });
      } catch {
        // Bỏ qua lỗi backend khi thu hồi phiên — vẫn xóa cookie phía client.
      }
    }
  }

  await clearSession();
  await clearCartToken();
  return NextResponse.json({ success: true });
}
