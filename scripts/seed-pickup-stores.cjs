/**
 * Idempotent local seed for pickup-capable stores.
 *
 * Does NOT modify HN-MAIN warehouse or reset inventory.
 *
 * Usage:
 *   $env:NEXATECH_ALLOW_DEV_SEED='YES'
 *   node scripts/seed-pickup-stores.cjs
 */
const INVENTORY_API =
  process.env.INVENTORY_API_BASE?.replace(/\/+$/, '') ||
  'http://localhost:8000';

const PICKUP_STORE = {
  code: 'HCM-NGUYEN-HUE',
  name: 'NexaTech Nguyễn Huệ',
  address: '125 Đường Nguyễn Huệ, Phường Bến Nghé',
  city: 'Hồ Chí Minh',
  phone: '02838221234',
  openingHours: 'T2–CN 9:00–21:00',
  pickupEnabled: true,
  isActive: true,
};

async function api(path, options = {}) {
  const res = await fetch(`${INVENTORY_API}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-user-id': 'seed-pickup-script',
      'x-user-roles': 'Admin,Manager',
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
    throw new Error(
      `${options.method || 'GET'} ${path} → ${res.status}: ${msg}`,
    );
  }
  return body;
}

async function ensurePickupStore() {
  const list = await api('/api/v1/stores');
  const stores = Array.isArray(list) ? list : [];
  const existing = stores.find((s) => s.code === PICKUP_STORE.code);
  if (existing?.id) {
    if (
      existing.pickupEnabled === true &&
      existing.isActive !== false &&
      existing.name === PICKUP_STORE.name
    ) {
      console.log(
        `[seed-pickup-stores] already present ${existing.code} (${existing.id})`,
      );
      return existing;
    }
    const updated = await api(`/api/v1/admin/inventory/stores/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: PICKUP_STORE.name,
        address: PICKUP_STORE.address,
        city: PICKUP_STORE.city,
        phone: PICKUP_STORE.phone,
        openingHours: PICKUP_STORE.openingHours,
        pickupEnabled: true,
        isActive: true,
      }),
    });
    console.log(`[seed-pickup-stores] updated ${updated.code}`);
    return updated;
  }

  const created = await api('/api/v1/admin/inventory/stores', {
    method: 'POST',
    body: JSON.stringify(PICKUP_STORE),
  });
  console.log(`[seed-pickup-stores] created ${created.code} (${created.id})`);
  return created;
}

async function main() {
  if (process.env.NEXATECH_ALLOW_DEV_SEED !== 'YES') {
    throw new Error('Set NEXATECH_ALLOW_DEV_SEED=YES to run pickup store seed');
  }

  const warehouses = await api('/api/v1/warehouses');
  const hnMain = Array.isArray(warehouses)
    ? warehouses.find((w) => w.code === 'HN-MAIN')
    : null;
  if (hnMain) {
    console.log(
      `[seed-pickup-stores] leaving warehouse ${hnMain.code} untouched`,
    );
  }

  const store = await ensurePickupStore();
  const pickup = await api('/api/v1/stores/pickup');
  const ids = (Array.isArray(pickup) ? pickup : []).map((s) => s.id);
  if (!ids.includes(store.id)) {
    throw new Error('Pickup list does not include seeded store');
  }
  console.log(
    `[seed-pickup-stores] done — pickup list has ${ids.length} store(s)`,
  );
}

main().catch((err) => {
  console.error('[seed-pickup-stores] FATAL:', err.message || err);
  process.exit(1);
});
