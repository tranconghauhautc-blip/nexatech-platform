import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('payment_mock');

export function setup() {
  const base = resolveBaseUrl();
  const paymentBase = (
    __ENV.PAYMENT_BASE_URL || `${base.replace(/:\d+$/, '')}:3008`
  ).replace(/\/$/, '');
  return { paymentBase };
}

export default function (data) {
  const res = getJson(`${data.paymentBase}/health/ready`, {
    tags: { name: 'payment_ready' },
  });
  okStatus(res, 'payment_ready');
  pace(0.3);
}
