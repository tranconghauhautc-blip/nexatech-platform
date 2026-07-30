import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('checkout_mock');

export function setup() {
  const base = resolveBaseUrl();
  const orderBase = (
    __ENV.ORDER_BASE_URL || `${base.replace(/:\d+$/, '')}:3007`
  ).replace(/\/$/, '');
  return { orderBase };
}

export default function (data) {
  // Mock-safe: readiness only unless ORDER_CREATE=1 with auth (operator)
  const res = getJson(`${data.orderBase}/health/ready`, {
    tags: { name: 'order_ready' },
  });
  okStatus(res, 'order_ready');
  pace(0.4);
}
