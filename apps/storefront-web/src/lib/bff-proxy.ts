import { NextRequest, NextResponse } from 'next/server';
import {
  bffTimeoutMs,
  fetchWithTimeout,
  sanitizeBffPathParts,
  upstreamUnavailableEnvelope,
} from '@nexatech/shared-web';
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
  const traceId = crypto.randomUUID();
  if (!isServiceName(service)) {
    return NextResponse.json(
      {
        errorCode: 'BFF_UNKNOWN_SERVICE',
        message: `Dịch vụ không hỗ trợ: ${service}`,
        details: {},
        traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 404 },
    );
  }

  const safeParts = sanitizeBffPathParts(pathParts);
  if (safeParts === null) {
    return NextResponse.json(
      {
        errorCode: 'BFF_INVALID_PATH',
        message: 'Đường dẫn API không hợp lệ',
        details: {},
        traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    );
  }

  const base = getInternalServiceBaseUrl(service);
  const subPath = safeParts.join('/');
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
    headers.set('x-request-id', traceId);
  }
  if (!headers.has('x-trace-id')) {
    headers.set('x-trace-id', traceId);
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
    const upstream = await fetchWithTimeout(target, init, bffTimeoutMs());
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }
    responseHeaders.set('x-request-id', headers.get('x-request-id') ?? traceId);
    responseHeaders.set('x-trace-id', headers.get('x-trace-id') ?? traceId);
    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(upstreamUnavailableEnvelope(traceId), {
      status: 502,
    });
  }
}
