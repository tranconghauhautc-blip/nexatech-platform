import { NextRequest, NextResponse } from 'next/server';
import {
  bffTimeoutMs,
  fetchWithTimeout,
  sanitizeBffPathParts,
  upstreamUnavailableEnvelope,
} from '@nexatech/shared-web';
import { isAdminServiceKey, resolveServiceBaseUrl } from './service-urls';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from './session';

export async function proxyToService(
  service: string,
  req: NextRequest,
  pathParts: string[],
) {
  return proxyAdminRequest(req, { service, path: pathParts });
}

export async function proxyAdminRequest(
  request: NextRequest,
  params: { service: string; path: string[] },
): Promise<NextResponse> {
  const traceId = crypto.randomUUID();
  if (!isAdminServiceKey(params.service)) {
    return NextResponse.json(
      {
        errorCode: 'BFF_UNKNOWN_SERVICE',
        message: `Dịch vụ không hỗ trợ: ${params.service}`,
        details: {},
        traceId,
        timestamp: new Date().toISOString(),
      },
      { status: 404 },
    );
  }

  const safeParts = sanitizeBffPathParts(params.path);
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

  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(sessionToken);

  const base = resolveServiceBaseUrl(params.service);
  const subPath = safeParts.join('/');
  const target = `${base}/api/v1/${subPath}${new URL(request.url).search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'cookie'
    ) {
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
    headers.set('x-user-roles', session.roles.join(','));
    headers.set('Authorization', `Bearer ${session.accessToken}`);
    if (session.email) {
      headers.set('x-user-email', session.email);
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
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
