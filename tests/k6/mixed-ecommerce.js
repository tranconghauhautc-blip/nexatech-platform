import { check } from 'k6';
import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  pace,
  labThresholds,
} from './lib/helpers.js';

export const options = defaultOptions('mixed_ecommerce', {
  thresholds: labThresholds({
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.08'],
  }),
});

export function setup() {
  const base = resolveBaseUrl();
  const host = base.replace(/:\d+$/, '');
  return {
    storefront: base,
    catalog: (__ENV.CATALOG_BASE_URL || `${host}:3003`).replace(/\/$/, ''),
    cart: (__ENV.CART_BASE_URL || `${host}:3006`).replace(/\/$/, ''),
    order: (__ENV.ORDER_BASE_URL || `${host}:3007`).replace(/\/$/, ''),
    payment: (__ENV.PAYMENT_BASE_URL || `${host}:3008`).replace(/\/$/, ''),
  };
}

export default function (data) {
  const home = getJson(`${data.storefront}/`, { tags: { name: 'mixed_home' } });
  const list = getJson(`${data.catalog}/api/v1/products?page=1&limit=10`, {
    tags: { name: 'mixed_catalog' },
  });
  const cart = getJson(`${data.cart}/health/ready`, {
    tags: { name: 'mixed_cart' },
  });
  const order = getJson(`${data.order}/health/ready`, {
    tags: { name: 'mixed_order' },
  });
  const pay = getJson(`${data.payment}/health/ready`, {
    tags: { name: 'mixed_payment' },
  });

  check(home, { 'mixed home <500': (r) => r.status > 0 && r.status < 500 });
  check(list, { 'mixed catalog <500': (r) => r.status > 0 && r.status < 500 });
  check(cart, { 'mixed cart <500': (r) => r.status > 0 && r.status < 500 });
  check(order, { 'mixed order <500': (r) => r.status > 0 && r.status < 500 });
  check(pay, { 'mixed payment <500': (r) => r.status > 0 && r.status < 500 });
  pace(0.5);
}
