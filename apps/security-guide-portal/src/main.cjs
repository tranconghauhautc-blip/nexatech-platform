'use strict';

/**
 * NexaTech Security Exploit Guide — authenticated local portal (port 3200).
 * Fail-closed without `.env.security-guide.local` from `pnpm security-guide:setup`.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const bcrypt = require('bcryptjs');

const PORT = Number(process.env.SECURITY_GUIDE_PORT || process.env.PORT || 3200);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE = 'nt_security_guide_session';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function resolveRootCandidates() {
  return [
    process.env.NEXATECH_ROOT,
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd()),
  ].filter(Boolean);
}

function loadConfig() {
  const fromFiles = {};
  for (const root of resolveRootCandidates()) {
    const local = path.join(root, '.env.security-guide.local');
    Object.assign(fromFiles, loadEnvFile(local));
  }
  // Process env wins so tests can inject temporary credentials safely.
  return {
    username:
      process.env.SECURITY_GUIDE_USERNAME ||
      fromFiles.SECURITY_GUIDE_USERNAME ||
      '',
    passwordHash:
      process.env.SECURITY_GUIDE_PASSWORD_HASH ||
      fromFiles.SECURITY_GUIDE_PASSWORD_HASH ||
      '',
    sessionSecret:
      process.env.SECURITY_GUIDE_SESSION_SECRET ||
      fromFiles.SECURITY_GUIDE_SESSION_SECRET ||
      '',
    ttlSeconds: Number(
      process.env.SECURITY_GUIDE_SESSION_TTL_SECONDS ||
        fromFiles.SECURITY_GUIDE_SESSION_TTL_SECONDS ||
        28800,
    ),
  };
}

function loadScenarios() {
  for (const root of resolveRootCandidates()) {
    const p = path.join(root, 'security-scenarios/scenarios.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return { version: 1, scenarios: [] };
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signSession(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifySession(token, secret) {
  if (!token || !secret) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf8',
      ),
    );
    if (!json.exp || Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function layout(title, body, { user } = {}) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title} — NexaTech Security Guide</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;margin:0;background:#0b1220;color:#e8eef7}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#121a2b;border-bottom:1px solid #243049}
a{color:#5eead4;text-decoration:none}a:hover{text-decoration:underline}
main{max-width:960px;margin:0 auto;padding:24px}
.card{background:#121a2b;border:1px solid #243049;border-radius:12px;padding:16px;margin:12px 0}
.banner{background:#7f1d1d;border:1px solid #f87171;color:#fecaca;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600}
.btn{display:inline-block;background:#2dd4bf;color:#042f2e;padding:8px 14px;border-radius:8px;border:0;font-weight:700;cursor:pointer}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e8eef7;box-sizing:border-box;margin:6px 0 12px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #243049;padding:8px;text-align:left;font-size:14px}
.err{color:#fecaca;background:#7f1d1d55;border:1px solid #f87171;padding:10px;border-radius:8px}
</style></head><body>
<header><div><strong>NexaTech</strong> · Security Exploit Guide</div>
<div>${user ? `<a href="/security-guide">Dashboard</a> · <a href="/security-guide/logout">Logout</a>` : ''}</div></header>
<main>${body}</main></body></html>`;
}

function unavailablePage() {
  return layout(
    'Unavailable',
    `<div class="banner">Intentionally Vulnerable Application</div>
    <div class="card"><h1>Security Guide unavailable</h1>
    <p>Missing local credentials. Run <code>pnpm security-guide:setup</code> then restart this portal.</p>
    <p>Fail-closed: no default username/password.</p></div>`,
  );
}

const config = loadConfig();
const catalog = loadScenarios();
const ready =
  config.username.length >= 3 &&
  config.passwordHash.length > 20 &&
  config.sessionSecret.length >= 32;
/** @type {Set<string>} */
const revokedNonces = new Set();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const cookies = parseCookies(req.headers.cookie);
  let session = ready
    ? verifySession(cookies[COOKIE], config.sessionSecret)
    : null;
  if (session?.nonce && revokedNonces.has(String(session.nonce))) {
    session = null;
  }

  if (!ready) {
    send(res, 503, unavailablePage());
    return;
  }

  if (url.pathname === '/health') {
    send(res, 200, JSON.stringify({ status: 'ok', ready }), 'application/json; charset=utf-8');
    return;
  }

  if (url.pathname === '/security-guide/login' && req.method === 'GET') {
    if (session) {
      res.writeHead(302, { Location: '/security-guide' });
      res.end();
      return;
    }
    const err = url.searchParams.get('e') === '1';
    send(
      res,
      200,
      layout(
        'Login',
        `<div class="banner">Intentionally Vulnerable — authorized testers only</div>
        <div class="card"><h1>Security Guide login</h1>
        ${err ? '<p class="err">Invalid username or password</p>' : ''}
        <form method="POST" action="/security-guide/login">
          <label>Username</label><input name="username" autocomplete="username" required />
          <label>Password</label><input name="password" type="password" autocomplete="current-password" required />
          <button class="btn" type="submit">Đăng nhập</button>
        </form></div>`,
      ),
    );
    return;
  }

  if (url.pathname === '/security-guide/login' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    const params = new URLSearchParams(raw);
    const username = (params.get('username') || '').trim();
    const password = params.get('password') || '';
    const userOk = username === config.username;
    const passOk = userOk
      ? await bcrypt.compare(password, config.passwordHash)
      : await bcrypt.compare(password, config.passwordHash);
    if (!userOk || !passOk) {
      res.writeHead(302, { Location: '/security-guide/login?e=1' });
      res.end();
      return;
    }
    const token = signSession(
      {
        sub: config.username,
        iat: Date.now(),
        exp: Date.now() + config.ttlSeconds * 1000,
        nonce: crypto.randomBytes(8).toString('hex'),
      },
      config.sessionSecret,
    );
    res.writeHead(302, {
      Location: '/security-guide',
      'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.ttlSeconds}`,
    });
    res.end();
    return;
  }

  if (url.pathname === '/security-guide/logout') {
    if (session?.nonce) {
      revokedNonces.add(String(session.nonce));
    }
    res.writeHead(302, {
      Location: '/security-guide/login',
      'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    });
    res.end();
    return;
  }

  const needsAuth =
    url.pathname.startsWith('/security-guide') ||
    url.pathname.startsWith('/api/security-guide');
  if (needsAuth && !session && url.pathname !== '/security-guide/login') {
    if (url.pathname.startsWith('/api/')) {
      send(
        res,
        401,
        JSON.stringify({
          errorCode: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
        'application/json; charset=utf-8',
      );
      return;
    }
    res.writeHead(302, { Location: '/security-guide/login' });
    res.end();
    return;
  }

  if (url.pathname === '/' || url.pathname === '/security-guide') {
    const scenarios = catalog.scenarios || [];
    const exploitable = scenarios.filter((s) => s.status === 'EXPLOITABLE').length;
    const rows = scenarios
      .map(
        (s) =>
          `<tr><td><a href="/security-guide/scenarios/${s.id}">${s.id}</a></td><td>${s.title}</td><td>${s.status}</td><td>${s.primaryCategory}</td><td>${s.service}</td></tr>`,
      )
      .join('');
    send(
      res,
      200,
      layout(
        'Dashboard',
        `<div class="banner">Intentionally Vulnerable Application — ALWAYS ON</div>
        <div class="card"><h1>Dashboard</h1>
        <p>Scenarios: ${scenarios.length} · EXPLOITABLE: ${exploitable}</p>
        <p><a href="/security-guide/api-2023">OWASP API Top 10:2023</a> ·
           <a href="/security-guide/web-2025">OWASP Web Top 10:2025</a> ·
           <a href="/security-guide/guides/owasp-api-top10">API HTML guide</a> ·
           <a href="/security-guide/guides/owasp-web-top10">Web HTML guide</a> ·
           <a href="http://localhost:8090/">Combined Swagger</a> ·
           <a href="http://localhost:8000/openapi/nexatech-combined.openapi.yaml">OpenAPI YAML</a></p>
        </div>
        <div class="card"><table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Category</th><th>Service</th></tr></thead><tbody>${rows}</tbody></table></div>`,
        { user: session },
      ),
    );
    return;
  }

  if (url.pathname === '/security-guide/api-2023') {
    const api = (catalog.scenarios || []).filter(
      (s) => (s.owaspApi2023 || []).length > 0,
    );
    send(
      res,
      200,
      layout(
        'API Top 10',
        `<div class="card"><h1>OWASP API Security Top 10:2023</h1>
        <ul>${api.map((s) => `<li><a href="/security-guide/scenarios/${s.id}">${s.id}</a> — ${s.title} (${(s.owaspApi2023 || []).join(', ')})</li>`).join('')}</ul></div>`,
        { user: session },
      ),
    );
    return;
  }

  if (url.pathname === '/security-guide/web-2025') {
    const web = (catalog.scenarios || []).filter(
      (s) => (s.owaspWeb2025 || []).length > 0,
    );
    send(
      res,
      200,
      layout(
        'Web Top 10',
        `<div class="card"><h1>OWASP Web Top 10:2025</h1>
        <ul>${web.map((s) => `<li><a href="/security-guide/scenarios/${s.id}">${s.id}</a> — ${s.title} (${(s.owaspWeb2025 || []).join(', ')})</li>`).join('')}</ul></div>`,
        { user: session },
      ),
    );
    return;
  }

  const scenarioMatch = /^\/security-guide\/scenarios\/([^/]+)$/.exec(
    url.pathname,
  );
  if (scenarioMatch) {
    const id = scenarioMatch[1];
    const s = (catalog.scenarios || []).find((x) => x.id === id);
    if (!s) {
      send(res, 404, layout('Not found', `<div class="card"><h1>Scenario not found</h1></div>`, { user: session }));
      return;
    }
    const curl = `curl -i -X ${s.method} "http://localhost:8000${s.path}"`;
    send(
      res,
      200,
      layout(
        s.id,
        `<div class="banner">Intentionally Vulnerable</div>
        <div class="card"><h1>${s.id}: ${s.title}</h1>
        <p><strong>Status:</strong> ${s.status}</p>
        <p><strong>Service:</strong> ${s.service} · <strong>${s.method}</strong> <code>${s.path}</code></p>
        <p><strong>operationId:</strong> ${s.operationId || '—'}</p>
        <p><strong>Roles:</strong> ${(s.roles || []).join(', ') || '—'}</p>
        <p><strong>Expected vulnerable behavior:</strong> ${s.expectedVulnerableBehavior || '—'}</p>
        <p><strong>Preconditions:</strong></p><ul>${(s.preconditions || []).map((p) => `<li>${p}</li>`).join('') || '<li>—</li>'}</ul>
        <p><button class="btn" type="button" onclick="navigator.clipboard.writeText(\`${curl.replace(/`/g, '\\`')}\`)">Copy curl</button>
        <a class="btn" href="http://localhost:${s.service === 'storefront-web' ? 3000 : 8090}/" style="margin-left:8px">Open Swagger / app</a></p>
        <pre style="white-space:pre-wrap;background:#0b1220;padding:12px;border-radius:8px">${curl}</pre>
        </div>`,
        { user: session },
      ),
    );
    return;
  }

  if (url.pathname === '/api/security-guide/scenarios') {
    send(
      res,
      200,
      JSON.stringify(catalog),
      'application/json; charset=utf-8',
    );
    return;
  }

  const guideMatch = /^\/security-guide\/guides\/([a-z0-9-]+)(?:\.html)?$/.exec(
    url.pathname,
  );
  if (guideMatch) {
    const name = guideMatch[1];
    const allowed = new Set(['owasp-api-top10', 'owasp-web-top10']);
    if (!allowed.has(name)) {
      send(
        res,
        404,
        layout('404', `<div class="card"><h1>Guide not found</h1></div>`, {
          user: session,
        }),
      );
      return;
    }
    let html = null;
    for (const root of resolveRootCandidates()) {
      const candidates = [
        path.join(root, 'apps/security-guide-portal/guides', `${name}.html`),
        path.join(__dirname, '../guides', `${name}.html`),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          html = fs.readFileSync(p, 'utf8');
          break;
        }
      }
      if (html) break;
    }
    if (!html) {
      send(
        res,
        404,
        layout('404', `<div class="card"><h1>Guide file missing</h1></div>`, {
          user: session,
        }),
      );
      return;
    }
    send(res, 200, html);
    return;
  }

  send(res, 404, layout('404', `<div class="card"><h1>Not found</h1></div>`, { user: session }));
});

server.listen(PORT, HOST, () => {
  console.log(
    `security-guide portal on http://localhost:${PORT}/security-guide (ready=${ready})`,
  );
});
