#!/usr/bin/env node
'use strict';

/**
 * Generate lab placeholder PNGs for catalog products (slug + skuCode stems).
 * Does not invent marketing photos — solid branded placeholders for MinIO/media PoC.
 *
 *   node scripts/generate-placeholder-product-images.cjs --dir imports/product-images --limit 100
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const CATALOG_API =
  process.env.CATALOG_API_BASE?.replace(/\/+$/, '') || 'http://localhost:8000';

function parseArgs(argv) {
  const out = { dir: 'imports/product-images', limit: 0 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dir') out.dir = argv[++i];
    else if (argv[i] === '--limit') out.limit = Number(argv[++i]) || 0;
  }
  return out;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** 64x64 RGB PNG with solid color derived from stem. */
function makePng(stem) {
  const hash = crypto.createHash('md5').update(stem).digest();
  const r = hash[0];
  const g = hash[1];
  const b = 180 + (hash[2] % 60);
  const w = 64;
  const h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x += 1) {
      const i = row + 1 + x * 3;
      const edge = x < 4 || y < 4 || x >= w - 4 || y >= h - 4;
      raw[i] = edge ? 255 : r;
      raw[i + 1] = edge ? 255 : g;
      raw[i + 2] = edge ? 255 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const absDir = path.resolve(args.dir);
  fs.mkdirSync(absDir, { recursive: true });

  const stems = new Set();
  let page = 1;
  for (;;) {
    const data = await fetchJson(
      `${CATALOG_API}/api/v1/products?page=${page}&pageSize=50&sort=newest`,
    );
    for (const item of data.items || []) {
      if (item.slug) stems.add(item.slug);
      const detail = await fetchJson(
        `${CATALOG_API}/api/v1/products/${encodeURIComponent(item.slug)}`,
      );
      for (const sku of detail.skus || []) {
        if (sku.skuCode) stems.add(sku.skuCode);
      }
    }
    const totalPages = data.meta?.totalPages ?? 1;
    if (page >= totalPages || !(data.items || []).length) break;
    page += 1;
    if (args.limit && stems.size >= args.limit * 2) break;
  }

  let list = [...stems].sort();
  if (args.limit > 0) list = list.slice(0, args.limit);

  let written = 0;
  for (const stem of list) {
    const file = path.join(absDir, `${stem}.png`);
    if (fs.existsSync(file)) continue;
    fs.writeFileSync(file, makePng(stem));
    written += 1;
  }
  console.log(
    `[generate-placeholder-product-images] dir=${absDir} stems=${list.length} written=${written}`,
  );
}

main().catch((err) => {
  console.error('[generate-placeholder-product-images] FATAL:', err.message || err);
  process.exit(1);
});
