import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { frameProtectionHeaders } from '@nexatech/shared-security-lab';

/**
 * SC-74 — apply frameProtectionHeaders() which is intentionally empty
 * (no X-Frame-Options / CSP frame-ancestors) for clickjacking PoC.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  const headers = frameProtectionHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
