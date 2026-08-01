/**
 * Seed demo warehouse stock for all catalog SKUs (local lab).
 *
 * Usage:
 *   $env:NEXATECH_ALLOW_DEV_SEED='YES'
 *   node scripts/seed-inventory.cjs
 *
 * Env (optional):
 *   CATALOG_API_BASE=http://localhost:8000
 *   INVENTORY_API_BASE=http://localhost:8000
 *   (or http://localhost:3003 / http://localhost:3005 for direct)
 */
const CATALOG_API =
  process.env.CATALOG_API_BASE?.replace(/\/+$/, '') || 'http://localhost:8000';
const INVENTORY_API =
  process.env.INVENTORY_API_BASE?.replace(/\/+$/, '') ||
  process.env.CATALOG_API_BASE?.replace(/\/+$/, '') ||
  'http://localhost:8000';
const QTY = Number(process.env.SEED_STOCK_QTY || 50);

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-user-id': 'seed-script',
      'x-user-roles': 'Staff,Admin',
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
    const msg =
      typeof body === 'object' && body?.message
        ? body.message
        : text.slice(0, 200);
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

async function listSkuCodes() {
  const codes = new Set();
  let page = 1;
  for (;;) {
    const data = await api(
      CATALOG_API,
      `/api/v1/products?page=${page}&pageSize=50&sort=newest`,
    );
    const items = data.items || [];
    for (const product of items) {
      const detail = await api(
        CATALOG_API,
        `/api/v1/products/${encodeURIComponent(product.slug)}`,
      );
      for (const sku of detail.skus || []) {
        if (sku.skuCode) codes.add(sku.skuCode);
      }
    }
    const totalPages = data.meta?.totalPages ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }
  return [...codes];
}

async function ensureWarehouse() {
  const list = await api(INVENTORY_API, '/api/v1/warehouses');
  const existing = Array.isArray(list)
    ? list.find((w) => w.code === 'HN-MAIN') || list[0]
    : null;
  if (existing?.id) {
    console.log(`[seed-inventory] warehouse ${existing.code} (${existing.id})`);
    return existing;
  }
  const created = await api(INVENTORY_API, '/api/v1/admin/inventory/warehouses', {
    method: 'POST',
    body: JSON.stringify({
      code: 'HN-MAIN',
      name: 'Kho Hà Nội chính',
      address: 'Hà Nội',
      isActive: true,
    }),
  });
  console.log(`[seed-inventory] created warehouse ${created.code}`);
  return created;
}

async function main() {
  if (process.env.NEXATECH_ALLOW_DEV_SEED !== 'YES') {
    throw new Error('Set NEXATECH_ALLOW_DEV_SEED=YES to run inventory seed');
  }

  const warehouse = await ensureWarehouse();
  const skuCodes = await listSkuCodes();
  console.log(`[seed-inventory] seeding ${skuCodes.length} SKUs × ${QTY}`);

  let ok = 0;
  for (const skuCode of skuCodes) {
    await api(INVENTORY_API, '/api/v1/admin/inventory/stock/receive', {
      method: 'POST',
      body: JSON.stringify({
        skuCode,
        locationType: 'warehouse',
        locationId: warehouse.id,
        quantity: QTY,
        idempotencyKey: `seed-receive:${skuCode}:v1`,
        note: 'Local lab seed',
      }),
    });
    ok += 1;
    if (ok % 20 === 0) {
      console.log(`[seed-inventory] ${ok}/${skuCodes.length}`);
    }
  }
  console.log(`[seed-inventory] done — ${ok} SKUs stocked at ${warehouse.code}`);
}

main().catch((err) => {
  console.error('[seed-inventory] FATAL:', err.message || err);
  process.exit(1);
});
