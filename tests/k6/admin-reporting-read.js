import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('admin_reporting_read');

export function setup() {
  const base = resolveBaseUrl();
  const reportingBase = (
    __ENV.REPORTING_BASE_URL || `${base.replace(/:\d+$/, '')}:3014`
  ).replace(/\/$/, '');
  return { reportingBase };
}

export default function (data) {
  // Unauthenticated read should fail closed (<500) — validates availability path
  const res = getJson(`${data.reportingBase}/health/ready`, {
    tags: { name: 'reporting_ready' },
  });
  okStatus(res, 'reporting_ready');
  pace(0.4);
}
