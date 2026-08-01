#!/usr/bin/env node
'use strict';

/**
 * Security Guide auth smoke tests (temporary credentials, no operator secrets).
 *
 *   pnpm security-guide:test
 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const root = path.resolve(__dirname, '../..');
const PORT = 3210 + Math.floor(Math.random() * 20);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function request(method, urlPath, { headers = {}, body, redirect = 'manual' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-guide-'));
  const envFile = path.join(tmpDir, '.env.security-guide.local');
  const username = 'guide-test-user';
  const password = `TmpGuide!${crypto.randomBytes(6).toString('hex')}`;
  const hash = await bcrypt.hash(password, 10);
  const secret = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(
    envFile,
    [
      `SECURITY_GUIDE_USERNAME=${username}`,
      `SECURITY_GUIDE_PASSWORD_HASH=${hash}`,
      `SECURITY_GUIDE_SESSION_SECRET=${secret}`,
      'SECURITY_GUIDE_SESSION_TTL_SECONDS=600',
      '',
    ].join('\n'),
  );

  // Copy scenarios next to env root expectation
  fs.mkdirSync(path.join(tmpDir, 'security-scenarios'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'security-scenarios/scenarios.json'),
    path.join(tmpDir, 'security-scenarios/scenarios.json'),
  );

  const child = spawn(process.execPath, [path.join(root, 'apps/security-guide-portal/src/main.cjs')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NEXATECH_ROOT: tmpDir,
      SECURITY_GUIDE_USERNAME: username,
      SECURITY_GUIDE_PASSWORD_HASH: hash,
      SECURITY_GUIDE_SESSION_SECRET: secret,
      SECURITY_GUIDE_SESSION_TTL_SECONDS: '600',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((r) => setTimeout(r, 1200));

  try {
    const health = await request('GET', '/health');
    assert(health.status === 200, `health ${health.status}`);
    assert(health.body.includes('"ready":true'), 'ready true');

    const unauth = await request('GET', '/security-guide');
    assert(unauth.status === 302, `unauth dashboard ${unauth.status}`);
    assert(
      String(unauth.headers.location || '').includes('/security-guide/login'),
      'redirect login',
    );

    const unauthApi = await request('GET', '/api/security-guide/scenarios');
    assert(unauthApi.status === 401, `unauth api ${unauthApi.status}`);

    const badLogin = await request('POST', '/security-guide/login', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'username=nope&password=nope-nope-nope',
    });
    assert(badLogin.status === 302, 'bad login redirect');
    assert(String(badLogin.headers.location || '').includes('e=1'), 'bad login flag');
    assert(!badLogin.body.includes(password), 'password not in response');

    const goodLogin = await request('POST', '/security-guide/login', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });
    assert(goodLogin.status === 302, `good login redirect got ${goodLogin.status} loc=${goodLogin.headers.location}`);
    const setCookieRaw = goodLogin.headers['set-cookie'];
    const setCookie = Array.isArray(setCookieRaw)
      ? setCookieRaw.join(';')
      : String(setCookieRaw || '');
    assert(/nt_security_guide_session=/.test(setCookie), `set cookie got=${setCookie}`);
    assert(/HttpOnly/i.test(setCookie), 'HttpOnly');
    assert(/SameSite=Strict/i.test(setCookie), 'SameSite=Strict');
    const cookie = setCookie.split(';')[0];

    const dash = await request('GET', '/security-guide', {
      headers: { cookie },
    });
    assert(dash.status === 200, `dashboard ${dash.status}`);
    assert(dash.body.includes('Intentionally Vulnerable'), 'banner');

    const api = await request('GET', '/api/security-guide/scenarios', {
      headers: { cookie },
    });
    assert(api.status === 200, `api ${api.status}`);
    assert(api.body.includes('scenarios'), 'scenarios json');

    const guideUnauth = await request('GET', '/security-guide/guides/owasp-api-top10');
    assert(guideUnauth.status === 302, `guide unauth ${guideUnauth.status}`);
    assert(
      String(guideUnauth.headers.location || '').includes('/security-guide/login'),
      'guide redirects login',
    );

    const guideAuth = await request('GET', '/security-guide/guides/owasp-api-top10', {
      headers: { cookie },
    });
    assert(guideAuth.status === 200, `guide auth ${guideAuth.status}`);
    assert(
      guideAuth.body.includes('API1') || guideAuth.body.includes('BOLA'),
      'guide html body',
    );

    const logout = await request('GET', '/security-guide/logout', {
      headers: { cookie },
    });
    assert(logout.status === 302, 'logout');

    const after = await request('GET', '/security-guide', {
      headers: { cookie },
    });
    assert(after.status === 302, 'session invalidated');

    // Fail-closed when env missing
    console.log('[security-guide:test] PASSED');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[security-guide:test] FAILED', err.message || err);
  process.exit(1);
});
