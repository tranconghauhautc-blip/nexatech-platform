import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('order_create_mock_safe');

export function setup() {
  const base = resolveBaseUrl();
  const orderBase = (
    __ENV.ORDER_BASE_URL || `${base.replace(/:\d+$/, '')}:3007`
  ).replace(/\/$/, '');
  return { orderBase };
}

export default function (data) {
  // Intentionally read-only in default lab mode — creating orders needs cart+auth.
  const res = getJson(`${data.orderBase}/health/live`, {
    tags: { name: 'order_live' },
  });
  okStatus(res, 'order_live');
  pace(0.3);
}
