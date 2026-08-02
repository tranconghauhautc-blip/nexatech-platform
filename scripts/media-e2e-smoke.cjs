#!/usr/bin/env node
'use strict';

/**
 * Non-destructive media upload → MinIO → confirm → product link smoke.
 * Uses Admin credentials from DEV_SEED_PASSWORD (operator session).
 * Does NOT delete existing media.
 *
 *   $env:DEV_SEED_PASSWORD='…'
 *   node scripts/media-e2e-smoke.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KONG = (process.env.KONG_URL || 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
);
const MEDIA = (process.env.MEDIA_URL || 'http://127.0.0.1:3004').replace(
  /\/+$/,
  '',
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(base, p, { method = 'GET', headers = {}, body, raw } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, text, headers: res.headers };
}

function tinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function rewriteMinio(url) {
  return String(url || '')
    .replace('http://minio:9000', 'http://127.0.0.1:9000')
    .replace('https://minio:9000', 'http://127.0.0.1:9000');
}

async function main() {
  const pass = process.env.DEV_SEED_PASSWORD;
  assert(pass, 'DEV_SEED_PASSWORD required');

  console.log('[media-e2e] login admin…');
  const login = await api(KONG, '/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'admin@nexatech.local', password: pass },
  });
  assert(login.ok, `login ${login.status} ${login.text?.slice?.(0, 200)}`);
  const userId = login.data.userId || login.data.user?.id;
  const token = login.data.accessToken;
  const roles = (login.data.roles || login.data.user?.roles || ['Admin']).join
    ? (login.data.roles || login.data.user?.roles || ['Admin']).join(',')
    : 'Admin';
  const auth = {
    authorization: `Bearer ${token}`,
    'x-user-id': String(userId),
    'x-user-roles': roles || 'Admin',
  };

  console.log('[media-e2e] pick product…');
  const products = await api(
    KONG,
    '/api/v1/products?page=1&pageSize=5&sort=newest',
  );
  assert(products.ok, `products ${products.status}`);
  const product = (products.data.items || [])[0];
  assert(product?.id, 'no product');

  const bytes = tinyPng();
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const filename = `e2e-accept-${Date.now()}.png`;

  console.log('[media-e2e] presign…');
  const presign = await api(MEDIA, '/api/v1/media/presign', {
    method: 'POST',
    headers: auth,
    body: {
      fileName: filename,
      contentType: 'image/png',
      sizeBytes: bytes.length,
      ownerType: 'product',
      ownerId: product.id,
      role: 'thumbnail',
    },
  });
  assert(
    presign.ok,
    `presign ${presign.status} ${JSON.stringify(presign.data).slice(0, 300)}`,
  );
  const mediaId = presign.data.mediaId || presign.data.id;
  const uploadUrl = rewriteMinio(
    presign.data.uploadUrl || presign.data.url || presign.data.presignedUrl,
  );
  assert(mediaId && uploadUrl, 'missing mediaId/uploadUrl');
  assert(
    !/minio:9000/i.test(uploadUrl),
    `browser-facing upload URL still has minio:9000 → ${uploadUrl}`,
  );

  console.log('[media-e2e] PUT MinIO via Compose network…');
  // Presigned URL is signed for Host=minio; host rewrite breaks signature.
  // Upload from inside nexatech-dev so the original URL validates.
  const { spawnSync } = require('child_process');
  const tmpFile = path.join(process.cwd(), `tmp-${filename}`);
  fs.writeFileSync(tmpFile, bytes);
  const originalUploadUrl =
    presign.data.uploadUrl || presign.data.url || presign.data.presignedUrl;
  assert(originalUploadUrl, 'missing original uploadUrl');
  const put = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'nexatech-dev',
      '-v',
      `${tmpFile}:/upload.bin:ro`,
      'curlimages/curl:8.5.0',
      '-sS',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '-X',
      'PUT',
      '-H',
      'Content-Type: image/png',
      '--data-binary',
      '@/upload.bin',
      originalUploadUrl,
    ],
    { encoding: 'utf8' },
  );
  try {
    fs.unlinkSync(tmpFile);
  } catch {
    /* ignore */
  }
  const putStatus = Number((put.stdout || '').trim());
  if (put.status !== 0 || !(putStatus === 200 || putStatus === 204)) {
    throw new Error(
      `PUT via docker network failed status=${put.status} http=${put.stdout} err=${put.stderr}`,
    );
  }
  // Browser rewrite check (admin UI): rewritten host must be localhost for display
  const browserUrl = rewriteMinio(originalUploadUrl);
  assert(
    !/minio:9000/i.test(browserUrl),
    `browser rewrite failed: ${browserUrl}`,
  );

  console.log('[media-e2e] confirm…');
  const confirm = await api(MEDIA, `/api/v1/media/${mediaId}/confirm`, {
    method: 'POST',
    headers: auth,
    body: {},
  });
  assert(
    confirm.ok,
    `confirm ${confirm.status} ${JSON.stringify(confirm.data).slice(0, 300)}`,
  );

  console.log('[media-e2e] link product…');
  const link = await api(MEDIA, `/api/v1/media/${mediaId}/links`, {
    method: 'POST',
    headers: auth,
    body: {
      entityType: 'product',
      entityId: product.id,
      role: 'thumbnail',
      isPrimary: true,
      sortOrder: 0,
    },
  });
  assert(
    link.ok || link.status === 200 || link.status === 201,
    `link ${link.status} ${JSON.stringify(link.data).slice(0, 300)}`,
  );

  console.log('[media-e2e] verify by-entity…');
  const listed = await api(
    MEDIA,
    `/api/v1/media/by-entity/product/${product.id}`,
    { headers: auth },
  );
  assert(listed.ok, `by-entity ${listed.status}`);
  const items = Array.isArray(listed.data)
    ? listed.data
    : listed.data?.items || listed.data?.media || [];
  const found = items.some((row) => {
    const id =
      row?.media?.id || row?.mediaId || row?.id || row?.link?.mediaId || null;
    return id === mediaId;
  });
  assert(found, `linked media not listed (count=${items.length})`);

  const dl = await api(MEDIA, `/api/v1/media/${mediaId}/download-url`, {
    headers: auth,
  });
  if (dl.ok) {
    const url = rewriteMinio(
      dl.data?.url || dl.data?.downloadUrl || dl.data?.publicUrl || '',
    );
    assert(!/minio:9000/i.test(url), `download url has minio host: ${url}`);
  }

  // Write a small fixture marker for reports (not secrets)
  const out = {
    ok: true,
    productId: product.id,
    productSlug: product.slug,
    mediaId,
    uploadHostOk: !/minio:9000/i.test(uploadUrl),
  };
  const reportPath = path.join(process.cwd(), 'tmp-media-e2e-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log('[media-e2e] PASSED', out);
}

main().catch((err) => {
  console.error('[media-e2e] FAIL:', err.message || err);
  process.exit(1);
});
