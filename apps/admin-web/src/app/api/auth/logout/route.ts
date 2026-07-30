import { NextResponse } from 'next/server';
import { resolveServiceBaseUrl } from '../../../../lib/service-urls';
import {
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
} from '../../../../lib/session';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(
    new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`),
  );
  const token = match ? decodeURIComponent(match[1]) : undefined;
  const session = await verifySessionToken(token);

  if (session) {
    try {
      const baseUrl = resolveServiceBaseUrl('identity');
      await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
        cache: 'no-store',
      });
    } catch {
      // Backend không khả dụng — vẫn xóa phiên phía trình duyệt để đăng xuất an toàn.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
