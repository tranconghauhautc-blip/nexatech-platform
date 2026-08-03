#!/usr/bin/env node
'use strict';

/**
 * Non-destructive media pipeline audit for local Compose.
 *
 * Checks:
 *   - media-service health
 *   - MinIO reachability (localhost:9000)
 *   - sample product→media links
 *   - download URLs are browser-resolvable (no minio:9000 hostname)
 *
 * Does NOT delete objects or media records.
 *
 *   pnpm media:audit
 */
const MEDIA = (process.env.MEDIA_URL || 'http://127.0.0.1:3004').replace(
  /\/+$/,
  '',
);
const CATALOG = (process.env.CATALOG_URL || 'http://127.0.0.1:3003').replace(
  /\/+$/,
  '',
);
const KONG = (process.env.KONG_URL || 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
);
const MINIO = (process.env.MINIO_PUBLIC_URL || 'http://127.0.0.1:9000').replace(
  /\/+$/,
  '',
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { accept: 'application/json', ...headers },
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

async function main() {
  const report = {
    mediaHealth: null,
    minio: null,
    productsSampled: 0,
    productsWithMedia: 0,
    brokenInternalHost: [],
    downloadOk: 0,
    downloadFail: 0,
    warnings: [],
  };

  console.log('[media:audit] probing media-service health…');
  const health = await get(`${MEDIA}/health`);
  assert(health.ok, `media health ${health.status}`);
  report.mediaHealth = health.status;

  console.log('[media:audit] probing MinIO…');
  try {
    const minio = await fetch(MINIO, { method: 'GET' });
    // MinIO may return 403 on root — reachable is enough
    report.minio = { status: minio.status, reachable: minio.status < 500 };
    assert(report.minio.reachable, `MinIO unreachable status=${minio.status}`);
  } catch (e) {
    throw new Error(`MinIO unreachable: ${e.message}`);
  }

  console.log('[media:audit] sampling catalog products…');
  const products = await get(
    `${KONG}/api/v1/products?page=1&pageSize=10&sort=newest`,
  );
  assert(products.ok, `catalog list ${products.status}`);
  const items = products.data?.items || [];
  report.productsSampled = items.length;

  for (const item of items) {
    const productId = item.id;
    if (!productId) continue;
    const linked = await get(
      `${MEDIA}/api/v1/media/by-entity/product/${productId}`,
      {
        'x-user-id': 'media-audit',
        'x-user-roles': 'Admin',
      },
    );
    if (!linked.ok) {
      // try alternate path conventions
      const alt = await get(
        `${MEDIA}/api/v1/media?entityType=product&entityId=${encodeURIComponent(productId)}`,
        { 'x-user-id': 'media-audit', 'x-user-roles': 'Admin' },
      );
      if (!alt.ok) {
        report.warnings.push(
          `no media listing for product ${item.slug || productId}: ${linked.status}/${alt.status}`,
        );
        continue;
      }
      linked.ok = alt.ok;
      linked.data = alt.data;
      linked.status = alt.status;
    }

    const mediaList = Array.isArray(linked.data)
      ? linked.data
      : linked.data?.items || linked.data?.media || [];
    if (!mediaList.length) continue;
    report.productsWithMedia += 1;

    const sample = mediaList[0];
    const url =
      sample?.publicUrl ||
      sample?.url ||
      sample?.downloadUrl ||
      sample?.cdnUrl ||
      '';
    if (typeof url === 'string' && /minio:9000/i.test(url)) {
      report.brokenInternalHost.push({
        productId,
        url: url.slice(0, 120),
      });
    }

    // Prefer download-url endpoint when id present
    const mediaId = sample?.id || sample?.mediaId;
    if (mediaId) {
      const dl = await get(`${MEDIA}/api/v1/media/${mediaId}/download-url`, {
        'x-user-id': 'media-audit',
        'x-user-roles': 'Admin',
      });
      if (dl.ok) {
        const signed =
          dl.data?.url || dl.data?.downloadUrl || dl.data?.publicUrl || '';
        if (typeof signed === 'string' && /minio:9000/i.test(signed)) {
          report.brokenInternalHost.push({
            productId,
            mediaId,
            url: signed.slice(0, 120),
          });
        } else if (signed) {
          // HEAD/GET may fail CORS from node; just ensure URL host is localhost/public
          const hostOk = !/minio:9000/i.test(signed);
          if (hostOk) report.downloadOk += 1;
          else report.downloadFail += 1;
        } else {
          report.downloadFail += 1;
        }
      } else {
        report.warnings.push(`download-url ${mediaId} → ${dl.status}`);
        report.downloadFail += 1;
      }
    }
  }

  console.log('[media:audit] report', JSON.stringify(report, null, 2));

  assert(report.mediaHealth === 200, 'media health not 200');
  assert(report.minio?.reachable, 'minio not reachable');
  if (report.brokenInternalHost.length) {
    console.error(
      '[media:audit] FAIL: browser-facing URLs contain internal hostname minio:9000',
    );
    process.exit(1);
  }
  if (report.productsSampled > 0 && report.productsWithMedia === 0) {
    console.warn(
      '[media:audit] WARN: sampled products have no linked media (import may be incomplete)',
    );
  }
  if (
    report.productsSampled > 0 &&
    report.productsWithMedia < report.productsSampled
  ) {
    console.error(
      `[media:audit] FAIL: only ${report.productsWithMedia}/${report.productsSampled} sampled products have media links`,
    );
    process.exit(1);
  }
  console.log('[media:audit] PASSED');
}

main().catch((err) => {
  console.error('[media:audit] FAIL:', err.message || err);
  process.exit(1);
});
