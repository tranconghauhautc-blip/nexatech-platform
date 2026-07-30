import { NextRequest, NextResponse } from 'next/server';
import { CART_TOKEN_COOKIE, SESSION_COOKIE, type SessionData } from './session';
import { getInternalServiceBaseUrl, isServiceName } from './env';

function readSession(req: NextRequest): SessionData | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
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

export async function proxyToService(
  service: string,
  req: NextRequest,
  pathParts: string[],
) {
  if (!isServiceName(service)) {
    return NextResponse.json(
      {
        errorCode: 'BFF_UNKNOWN_SERVICE',
        message: `Dịch vụ không hỗ trợ: ${service}`,
        traceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      { status: 404 },
    );
  }

  const base = getInternalServiceBaseUrl(service);
  const subPath = pathParts.join('/');
  const target = `${base}/api/v1/${subPath}${new URL(req.url).search}`;
  const session = readSession(req);
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (['host', 'connection', 'content-length', 'cookie'].includes(lower)) {
      return;
    }
    headers.set(key, value);
  });
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', crypto.randomUUID());
  }
  if (!headers.has('x-trace-id')) {
    headers.set('x-trace-id', crypto.randomUUID());
  }
  if (session) {
    headers.set('x-user-id', session.userId);
    headers.set('x-user-roles', (session.roles ?? []).join(','));
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  const cartToken = req.cookies.get(CART_TOKEN_COOKIE)?.value;
  if (cartToken) {
    headers.set('x-cart-token', cartToken);
  }

  const init: RequestInit = { method: req.method, headers, cache: 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        errorCode: 'UPSTREAM_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'Không kết nối được dịch vụ backend',
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
