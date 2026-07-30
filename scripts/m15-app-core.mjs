/**
 * M15 app core — BFF, auth, UI primitives for storefront + admin
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log('W', rel);
}

const bffProxy = `import { NextRequest, NextResponse } from 'next/server';
import { resolveServiceBaseUrl } from '@nexatech/shared-web';

const SESSION_COOKIE = 'nt_session';

type SessionPayload = {
  userId: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  email?: string;
  fullName?: string;
};

function readSession(req: NextRequest): SessionPayload | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionPayload;
  } catch {
    return null;
  }
}

export async function proxyToService(
  service: string,
  req: NextRequest,
  pathParts: string[],
) {
  const base = resolveServiceBaseUrl(service);
  const subPath = pathParts.join('/');
  const url = new URL(req.url);
  const target = \`\${base}/api/v1/\${subPath}\${url.search}\`;

  const session = readSession(req);
  const headers = new Headers();
  req.headers.forEach((value, key) => {
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
    headers.set('Authorization', \`Bearer \${session.accessToken}\`);
  }
  const cartToken = req.cookies.get('nt_cart_token')?.value;
  if (cartToken) {
    headers.set('x-cart-token', cartToken);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    duplex: 'half',
  } as RequestInit;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);
    const traceId = upstream.headers.get('x-trace-id');
    if (traceId) responseHeaders.set('x-trace-id', traceId);
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
`;

write('apps/storefront-web/src/lib/bff-proxy.ts', bffProxy);
write('apps/admin-web/src/lib/bff-proxy.ts', bffProxy);

const services = [
  'identity',
  'customer',
  'catalog',
  'media',
  'inventory',
  'cart',
  'order',
  'payment',
  'shipping',
  'review',
  'warranty',
  'support',
  'notification',
  'reporting',
];

for (const app of ['storefront-web', 'admin-web']) {
  for (const service of services) {
    write(
      `apps/${app}/src/app/api/bff/${service}/[...path]/route.ts`,
      `import { NextRequest } from 'next/server';
import { proxyToService } from '../../../../../lib/bff-proxy';

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToService('${service}', req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
`,
    );
  }
}

const authRoutes = `import { NextRequest, NextResponse } from 'next/server';
import { resolveServiceBaseUrl } from '@nexatech/shared-web';

const SESSION_COOKIE = 'nt_session';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

type SessionPayload = {
  userId: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  email?: string;
  fullName?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part, 'base64url').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function setSession(res: NextResponse, session: SessionPayload) {
  res.cookies.set(
    SESSION_COOKIE,
    encodeURIComponent(JSON.stringify(session)),
    COOKIE_OPTS,
  );
}

export async function POST_login(req: NextRequest) {
  const body = await req.json();
  const base = resolveServiceBaseUrl('identity');
  const upstream = await fetch(\`\${base}/api/v1/auth/login\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }
  const claims = decodeJwtPayload(data.accessToken as string) ?? {};
  const roles = Array.isArray(claims['roles'])
    ? (claims['roles'] as string[])
    : ['Customer'];
  const session: SessionPayload = {
    userId: data.userId as string,
    roles,
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    email: typeof claims['email'] === 'string' ? claims['email'] : body.email,
  };
  const res = NextResponse.json({
    userId: session.userId,
    roles: session.roles,
    email: session.email,
    expiresIn: data.expiresIn,
  });
  setSession(res, session);
  return res;
}

export async function POST_register(req: NextRequest) {
  const body = await req.json();
  const base = resolveServiceBaseUrl('identity');
  const upstream = await fetch(\`\${base}/api/v1/auth/register\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function POST_logout() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}

export async function GET_session(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ authenticated: false });
  }
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as SessionPayload;
    return NextResponse.json({
      authenticated: true,
      userId: session.userId,
      roles: session.roles,
      email: session.email,
      fullName: session.fullName,
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
`;

write('apps/storefront-web/src/lib/auth-handlers.ts', authRoutes);
write('apps/admin-web/src/lib/auth-handlers.ts', authRoutes);

for (const app of ['storefront-web', 'admin-web']) {
  write(
    `apps/${app}/src/app/api/auth/login/route.ts`,
    `import { NextRequest } from 'next/server';
import { POST_login } from '../../../lib/auth-handlers';

export async function POST(req: NextRequest) {
  return POST_login(req);
}
`,
  );
  write(
    `apps/${app}/src/app/api/auth/register/route.ts`,
    `import { NextRequest } from 'next/server';
import { POST_register } from '../../../lib/auth-handlers';

export async function POST(req: NextRequest) {
  return POST_register(req);
}
`,
  );
  write(
    `apps/${app}/src/app/api/auth/logout/route.ts`,
    `import { POST_logout } from '../../../lib/auth-handlers';

export async function POST() {
  return POST_logout();
}
`,
  );
  write(
    `apps/${app}/src/app/api/auth/session/route.ts`,
    `import { NextRequest } from 'next/server';
import { GET_session } from '../../../lib/auth-handlers';

export async function GET(req: NextRequest) {
  return GET_session(req);
}
`,
  );
}

console.log('bff+auth done');
