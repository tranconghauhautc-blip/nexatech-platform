import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('cart_validation');

export function setup() {
  const base = resolveBaseUrl();
  const cartBase = (
    __ENV.CART_BASE_URL || `${base.replace(/:\d+$/, '')}:3006`
  ).replace(/\/$/, '');
  return { cartBase };
}

export default function (data) {
  const res = getJson(`${data.cartBase}/health/live`, {
    tags: { name: 'cart_live' },
  });
  okStatus(res, 'cart_live');
  pace(0.3);
}
