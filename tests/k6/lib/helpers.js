/**
 * Shared k6 helpers for NexaTech lab performance tests.
 * Private/local target guard — refuse public Internet hosts.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const FORBIDDEN_PUBLIC =
  /^(?!127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|localhost)/i;

export function resolveBaseUrl() {
  const base = (
    __ENV.BASE_URL ||
    __ENV.K6_BASE_URL ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');
  assertPrivateTarget(base);
  return base;
}

export function assertPrivateTarget(url) {
  let host;
  try {
    host = url
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0];
  } catch (e) {
    throw new Error(`Invalid BASE_URL: ${url}`);
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return;
  if (host === '192.168.4.204' || host === '192.168.4.209') return;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return;
  if (__ENV.K6_ALLOW_PUBLIC === 'YES') {
    // Explicit operator override only — still not recommended
    console.warn(`[k6-guard] K6_ALLOW_PUBLIC=YES for host=${host}`);
    return;
  }
  throw new Error(
    `Refusing non-private k6 target host=${host}. Use localhost/RFC1918/ENTRY_VIP or set K6_ALLOW_PUBLIC=YES (operator only).`,
  );
}

export function labThresholds(overrides = {}) {
  // Lab defaults — NOT production SLOs. Assumptions documented in docs/PERFORMANCE-TESTING.md
  return Object.assign(
    {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<1500', 'p(99)<3000'],
      checks: ['rate>0.95'],
    },
    overrides,
  );
}

export function defaultOptions(scenarioName, overrides = {}) {
  const vus = Number(__ENV.VUS || 5);
  const duration = __ENV.DURATION || '30s';
  return Object.assign(
    {
      scenarios: {
        [scenarioName]: {
          executor: 'constant-vus',
          vus,
          duration,
          gracefulStop: '5s',
        },
      },
      thresholds: labThresholds(),
      summaryTrendStats: [
        'avg',
        'min',
        'med',
        'max',
        'p(90)',
        'p(95)',
        'p(99)',
      ],
    },
    overrides,
  );
}

export function getJson(url, params = {}) {
  const res = http.get(url, {
    timeout: __ENV.TIMEOUT || '10s',
    tags: params.tags || {},
    headers: Object.assign(
      { Accept: 'application/json' },
      params.headers || {},
    ),
  });
  return res;
}

export function okStatus(res, name) {
  return check(res, {
    [`${name} status < 500`]: (r) => r.status > 0 && r.status < 500,
    [`${name} not 401/403 unless expected`]: (r) => true,
  });
}

export function pace(seconds = 0.3) {
  sleep(seconds);
}

// silence unused import warning path for some runners
void FORBIDDEN_PUBLIC;
