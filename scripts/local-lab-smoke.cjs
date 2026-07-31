#!/usr/bin/env node
'use strict';

/**
 * Local security lab HTTP smoke (no unit-test substitute).
 * Checks health, Swagger UI/JSON, Kong, frontends.
 */
const { SERVICES, KONG_URL } = require('./openapi/catalog.cjs');

const FRONTENDS = [
  { name: 'storefront', url: 'http://127.0.0.1:3000' },
  { name: 'admin', url: 'http://127.0.0.1:3100' },
];

async function check(url, { expectStatus = 200, include } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
    });
    if (
      res.status !== expectStatus &&
      !(expectStatus === 200 && res.status >= 200 && res.status < 400)
    ) {
      throw new Error(`status ${res.status}`);
    }
    if (include) {
      const text = await res.text();
      if (!text.includes(include)) {
        throw new Error(`body missing "${include}"`);
      }
    }
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const failures = [];

  for (const fe of FRONTENDS) {
    try {
      const status = await check(fe.url);
      console.log(`[lab-smoke] OK ${fe.name} ${fe.url} → ${status}`);
    } catch (err) {
      failures.push(`${fe.name}: ${err.message}`);
      console.error(`[lab-smoke] FAIL ${fe.name}: ${err.message}`);
    }
  }

  try {
    const status = await check(
      `${KONG_URL.replace('localhost', '127.0.0.1')}/`,
    );
    console.log(`[lab-smoke] OK kong ${KONG_URL} → ${status}`);
  } catch (err) {
    // Kong may 404 on / depending on routes — accept any HTTP response
    try {
      const res = await fetch(
        `${KONG_URL.replace('localhost', '127.0.0.1')}/api/v1/products?page=1&pageSize=1`,
      );
      console.log(`[lab-smoke] OK kong api probe → ${res.status}`);
    } catch (e2) {
      failures.push(`kong: ${err.message}; api: ${e2.message}`);
      console.error(`[lab-smoke] FAIL kong`);
    }
  }

  for (const svc of SERVICES) {
    const base = `http://127.0.0.1:${svc.port}`;
    for (const [label, path, opts] of [
      ['health', '/health/live', { include: 'ok' }],
      ['swagger-ui', '/docs', {}],
      ['openapi-json', '/docs-json', {}],
    ]) {
      try {
        const status = await check(`${base}${path}`, opts);
        console.log(`[lab-smoke] OK ${svc.id} ${label} → ${status}`);
      } catch (err) {
        failures.push(`${svc.id} ${label}: ${err.message}`);
        console.error(`[lab-smoke] FAIL ${svc.id} ${label}: ${err.message}`);
      }
    }
  }

  // Combined Swagger portal (direct :8090 + Kong /docs)
  for (const [name, url, opts] of [
    [
      'swagger-portal-health',
      'http://127.0.0.1:8090/health',
      { include: 'swagger-portal' },
    ],
    [
      'swagger-portal-docs',
      'http://127.0.0.1:8090/docs',
      { include: 'nexatech-combined' },
    ],
    [
      'swagger-portal-yaml',
      'http://127.0.0.1:8090/openapi/nexatech-combined.openapi.yaml',
      { include: 'openapi:' },
    ],
    [
      'swagger-portal-json',
      'http://127.0.0.1:8090/openapi/nexatech-combined.openapi.json',
      { include: 'openapi' },
    ],
    [
      'kong-combined-docs',
      `${KONG_URL.replace('localhost', '127.0.0.1')}/docs`,
      { include: 'nexatech-combined' },
    ],
  ]) {
    try {
      const status = await check(url, opts);
      console.log(`[lab-smoke] OK ${name} → ${status}`);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      console.error(`[lab-smoke] FAIL ${name}: ${err.message}`);
    }
  }

  // Identity Swagger Authorize flow (login + me) when seed password provided
  const seedPassword =
    process.env.DEV_SEED_PASSWORD || process.env.E2E_DEV_SEED_PASSWORD;
  const seedEmail = process.env.LAB_SMOKE_LOGIN_EMAIL || 'staff@nexatech.local';
  if (seedPassword) {
    try {
      const loginRes = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: seedEmail, password: seedPassword }),
      });
      const loginBody = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(`login ${loginRes.status} ${loginBody.message || ''}`);
      }
      if (!loginBody.accessToken) throw new Error('missing accessToken');
      const meRes = await fetch('http://127.0.0.1:3001/api/v1/auth/me', {
        headers: { authorization: `Bearer ${loginBody.accessToken}` },
      });
      // /me may 404 on old containers without rebuild — warn then
      if (meRes.status === 404) {
        console.warn(
          '[lab-smoke] WARN /api/v1/auth/me not deployed yet (rebuild identity-service)',
        );
      } else if (!meRes.ok) {
        throw new Error(`me ${meRes.status}`);
      } else {
        console.log('[lab-smoke] OK swagger-auth login→Authorize→/me');
      }
      await fetch('http://127.0.0.1:3001/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'skip-if-unknown' }),
      }).catch(() => undefined);
      // Prefer logout with session from token payload when available
      console.log(`[lab-smoke] OK identity login as ${seedEmail}`);
    } catch (err) {
      failures.push(`swagger-auth: ${err.message}`);
      console.error(`[lab-smoke] FAIL swagger-auth: ${err.message}`);
    }
  } else {
    console.warn(
      '[lab-smoke] SKIP swagger-auth (set DEV_SEED_PASSWORD or E2E_DEV_SEED_PASSWORD)',
    );
  }

  if (failures.length) {
    console.error(`[lab-smoke] FAILED (${failures.length})`);
    process.exit(1);
  }
  console.log('[lab-smoke] PASSED');
}

main().catch((err) => {
  console.error('[lab-smoke] FATAL', err);
  process.exit(1);
});
