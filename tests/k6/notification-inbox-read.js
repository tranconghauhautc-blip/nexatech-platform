import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('notification_inbox_read');

export function setup() {
  const base = resolveBaseUrl();
  const notificationBase = (
    __ENV.NOTIFICATION_BASE_URL || `${base.replace(/:\d+$/, '')}:3013`
  ).replace(/\/$/, '');
  return { notificationBase };
}

export default function (data) {
  const res = getJson(`${data.notificationBase}/health/ready`, {
    tags: { name: 'notification_ready' },
  });
  okStatus(res, 'notification_ready');
  pace(0.3);
}
