#!/usr/bin/env node
'use strict';

/**
 * Batch-map local image files → catalog products by skuCode or slug filename stem.
 *
 * Usage:
 *   $env:NEXATECH_ALLOW_DEV_SEED='YES'
 *   node scripts/import-product-images.cjs --dir imports/product-images --dry-run
 *   node scripts/import-product-images.cjs --dir imports/product-images
 *
 * Does NOT invent images. Reports missing / duplicate / invalid MIME.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const CATALOG_API =
  process.env.CATALOG_API_BASE?.replace(/\/+$/, '') || 'http://localhost:8000';
const MEDIA_API =
  process.env.MEDIA_API_BASE?.replace(/\/+$/, '') || 'http://localhost:8000';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function parseArgs(argv) {
  const out = { dir: '', dryRun: false, report: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--dir') out.dir = argv[++i];
    else if (a === '--report') out.report = argv[++i];
  }
  return out;
}

async function api(base, p, options = {}) {
  const res = await fetch(`${base}${p}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-user-id': 'image-import',
      'x-user-roles': 'Staff,Manager,Admin',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `${options.method || 'GET'} ${p} → ${res.status}: ${typeof body === 'object' ? body?.message || JSON.stringify(body) : text.slice(0, 200)}`,
    );
  }
  return body;
}

async function loadCatalogIndex() {
  const bySku = new Map();
  const bySlug = new Map();
  let page = 1;
  for (;;) {
    const data = await api(
      CATALOG_API,
      `/api/v1/products?page=${page}&pageSize=50&sort=newest`,
    );
    for (const item of data.items || []) {
      bySlug.set(item.slug, item);
      const detail = await api(
        CATALOG_API,
        `/api/v1/products/${encodeURIComponent(item.slug)}`,
      );
      for (const sku of detail.skus || []) {
        if (sku.skuCode) bySku.set(sku.skuCode, { product: detail, sku });
      }
    }
    const totalPages = data.meta?.totalPages ?? 1;
    if (page >= totalPages || !(data.items || []).length) break;
    page += 1;
  }
  return { bySku, bySlug };
}

function walkImages(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (!EXT_MIME[ext]) continue;
    files.push(full);
  }
  return files;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) {
    console.log(`Usage: node scripts/import-product-images.cjs --dir <folder> [--dry-run] [--report report.json]
Filename stem must match product slug or skuCode.`);
    process.exit(1);
  }
  if (!args.dryRun && process.env.NEXATECH_ALLOW_DEV_SEED !== 'YES') {
    throw new Error('Set NEXATECH_ALLOW_DEV_SEED=YES for non-dry-run import');
  }
  const absDir = path.resolve(args.dir);
  const files = walkImages(absDir);
  const { bySku, bySlug } = await loadCatalogIndex();

  const report = {
    scanned: files.length,
    matched: [],
    missing: [],
    invalidMime: [],
    duplicates: [],
    uploaded: [],
    errors: [],
  };
  const seenStem = new Map();

  for (const file of files) {
    const base = path.basename(file);
    const stem = base.replace(/\.[^.]+$/, '').replace(/-gallery-\d+$/i, '');
    const mime = EXT_MIME[path.extname(file).toLowerCase()];
    if (!ALLOWED.has(mime)) {
      report.invalidMime.push({ file: base, mime });
      continue;
    }
    if (seenStem.has(stem)) {
      report.duplicates.push({ file: base, previous: seenStem.get(stem) });
      continue;
    }
    seenStem.set(stem, base);

    const hit = bySku.get(stem) || (bySlug.has(stem) ? { product: bySlug.get(stem) } : null);
    if (!hit) {
      report.missing.push({ file: base, stem });
      continue;
    }
    report.matched.push({
      file: base,
      stem,
      productId: hit.product.id,
      slug: hit.product.slug,
      skuCode: hit.sku?.skuCode,
    });

    if (args.dryRun) continue;

    try {
      const buf = fs.readFileSync(file);
      const presign = await api(MEDIA_API, '/api/v1/media/presign', {
        method: 'POST',
        body: JSON.stringify({
          fileName: base,
          contentType: mime,
          byteSize: buf.length,
          purpose: 'product',
        }),
      });
      // Prefer PUT to uploadUrl when provided; otherwise record for manual upload.
      if (presign.uploadUrl) {
        const put = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': mime },
          body: buf,
        });
        if (!put.ok) {
          throw new Error(`upload PUT ${put.status}`);
        }
        await api(MEDIA_API, `/api/v1/media/${presign.mediaId}/confirm`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        // Best-effort link if API supports it
        try {
          await api(MEDIA_API, `/api/v1/media/${presign.mediaId}/links`, {
            method: 'POST',
            body: JSON.stringify({
              entityType: 'product',
              entityId: hit.product.id,
              role: 'thumbnail',
            }),
          });
        } catch {
          // link endpoint shape may differ — media still uploaded
        }
        report.uploaded.push({
          file: base,
          mediaId: presign.mediaId,
          productId: hit.product.id,
        });
      } else {
        report.errors.push({ file: base, error: 'presign missing uploadUrl' });
      }
    } catch (err) {
      report.errors.push({ file: base, error: err.message || String(err) });
    }
  }

  const reportPath =
    args.report ||
    path.join(root, `tmp-image-import-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `[import-product-images] scanned=${report.scanned} matched=${report.matched.length} missing=${report.missing.length} uploaded=${report.uploaded.length} errors=${report.errors.length}`,
  );
  console.log(`[import-product-images] report=${reportPath}`);
  if (report.missing.length && args.dryRun) {
    console.log('[import-product-images] sample missing:', report.missing.slice(0, 5));
  }
}

main().catch((err) => {
  console.error('[import-product-images] FATAL:', err.message || err);
  process.exit(1);
});
