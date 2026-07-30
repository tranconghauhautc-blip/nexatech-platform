import http from 'k6/http';
import { check } from 'k6';
import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
  labThresholds,
} from './lib/helpers.js';

export const options = defaultOptions('cart_mutation', {
  thresholds: labThresholds({ http_req_failed: ['rate<0.1'] }),
});

export function setup() {
  const base = resolveBaseUrl();
  const cartBase = (
    __ENV.CART_BASE_URL || `${base.replace(/:\d+$/, '')}:3006`
  ).replace(/\/$/, '');
  return { cartBase };
}

export default function (data) {
  // Read-only validation of cart health + empty guest cart endpoint shape.
  // Full mutate requires guest token issuance — optional via CART_MUTATE=1
  const health = getJson(`${data.cartBase}/health/ready`, {
    tags: { name: 'cart_ready' },
  });
  okStatus(health, 'cart_ready');

  if (__ENV.CART_MUTATE === '1') {
    const res = http.post(
      `${data.cartBase}/api/v1/cart/guest`,
      JSON.stringify({}),
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        tags: { name: 'cart_guest_create' },
        timeout: '10s',
      },
    );
    check(res, {
      'cart guest create < 500': (r) => r.status > 0 && r.status < 500,
    });
    // Do not log response bodies (may contain tokens)
  }
  pace(0.5);
}
