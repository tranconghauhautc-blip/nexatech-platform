import { NextResponse, type NextRequest } from 'next/server';
import { decideAdminAccess } from './lib/auth-guard';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from './lib/session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const decision = decideAdminAccess(session, request.nextUrl.pathname);

  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
