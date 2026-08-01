#!/usr/bin/env node
'use strict';

/**
 * End-to-end customer checkout smoke via Kong (register → cart → order → COD payment).
 *
 *   pnpm checkout:smoke
 */
const crypto = require('crypto');

const KONG = (process.env.KONG_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const IDENTITY =
  (process.env.IDENTITY_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(base, p, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, text };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const email = `customer.smoke.${stamp}@nexatech.local`;
  const password = `CustomerPass1!${crypto.randomBytes(3).toString('hex')}`;

  console.log(`[checkout:smoke] register ${email}`);
  const reg = await api(KONG, '/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, fullName: 'Smoke Customer' },
  });
  assert(reg.ok, `register ${reg.status} ${reg.text?.slice?.(0, 200) || reg.text}`);

  if (reg.data?.debugOtp) {
    const ver = await api(KONG, '/api/v1/auth/verify-email', {
      method: 'POST',
      body: { email, code: reg.data.debugOtp },
    });
    assert(ver.ok || ver.status === 200, `verify ${ver.status}`);
  } else {
    const bypass = await api(
      IDENTITY,
      `/lab/verify-bypass?email=${encodeURIComponent(email)}`,
    );
    assert(bypass.ok || bypass.status < 500, `verify-bypass ${bypass.status}`);
  }

  const login = await api(KONG, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert(login.ok, `login ${login.status} ${login.text?.slice?.(0, 200)}`);
  const userId = login.data.userId || login.data.user?.id;
  const token = login.data.accessToken;
  assert(userId && token, 'missing userId/accessToken');

  const auth = {
    authorization: `Bearer ${token}`,
    'x-user-id': String(userId),
    'x-user-roles': 'Customer',
  };

  const products = await api(KONG, '/api/v1/products?page=1&pageSize=5&sort=newest');
  assert(products.ok && products.data?.items?.length, 'no products');
  let skuCode = null;
  let slug = null;
  for (const item of products.data.items) {
    const detail = await api(KONG, `/api/v1/products/${encodeURIComponent(item.slug)}`);
    const sku = detail.data?.skus?.[0];
    if (sku?.skuCode) {
      skuCode = sku.skuCode;
      slug = item.slug;
      break;
    }
  }
  assert(skuCode, 'no skuCode found');
  console.log(`[checkout:smoke] sku=${skuCode} slug=${slug}`);

  const cart = await api(KONG, '/api/v1/carts/current/items', {
    method: 'POST',
    headers: auth,
    body: { skuCode, quantity: 1 },
  });
  assert(cart.ok, `add cart ${cart.status} ${cart.text?.slice?.(0, 300)}`);
  assert((cart.data?.items || []).length >= 1, 'cart empty after add');

  const order = await api(KONG, '/api/v1/orders', {
    method: 'POST',
    headers: auth,
    body: {
      idempotencyKey: crypto.randomUUID(),
      deliveryMethod: 'STANDARD',
      paymentMethod: 'COD',
      shippingAddress: {
        recipientName: 'Nguyen Van A',
        recipientPhone: '0901234567',
        line1: '123 Duong Lab Smoke',
        city: 'Ha Noi',
        country: 'VN',
      },
    },
  });
  assert(order.ok, `order ${order.status} ${order.text?.slice?.(0, 400)}`);
  assert(order.data?.id, 'missing order id');
  console.log(
    `[checkout:smoke] order=${order.data.id} code=${order.data.orderCode} status=${order.data.status}`,
  );

  const payment = await api(KONG, '/api/v1/payments', {
    method: 'POST',
    headers: auth,
    body: {
      orderId: order.data.id,
      idempotencyKey: crypto.randomUUID(),
      method: 'COD',
    },
  });
  assert(payment.ok, `payment ${payment.status} ${payment.text?.slice?.(0, 400)}`);
  console.log(
    `[checkout:smoke] payment=${payment.data?.id || payment.data?.paymentId} status=${payment.data?.status}`,
  );
  console.log('[checkout:smoke] PASSED');
}

main().catch((err) => {
  console.error('[checkout:smoke] FAILED', err.message || err);
  process.exit(1);
});
