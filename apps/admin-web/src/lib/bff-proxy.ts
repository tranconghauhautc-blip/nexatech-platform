import { NextRequest, NextResponse } from 'next/server';
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
  if (!isAdminServiceKey(params.service)) {
    return NextResponse.json(
      {
        errorCode: 'BFF_UNKNOWN_SERVICE',
        message: `Dịch vụ không hỗ trợ: ${params.service}`,
        traceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      { status: 404 },
    );
  }

  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(sessionToken);

  const base = resolveServiceBaseUrl(params.service);
  const subPath = params.path.join('/');
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
    headers.set('x-request-id', crypto.randomUUID());
  }
  if (!headers.has('x-trace-id')) {
    headers.set('x-trace-id', crypto.randomUUID());
  }
  if (session) {
    headers.set('x-user-id', session.userId);
    headers.set('x-user-roles', session.roles.join(','));
    headers.set('Authorization', `Bearer ${session.accessToken}`);
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
        traceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
