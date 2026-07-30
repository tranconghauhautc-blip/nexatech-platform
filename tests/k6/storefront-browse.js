import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('storefront_browse');

export function setup() {
  return { base: resolveBaseUrl() };
}

export default function (data) {
  const res = getJson(`${data.base}/`, { tags: { name: 'storefront_home' } });
  okStatus(res, 'storefront_home');
  pace(0.5);
}

export function teardown() {
  // no persistent data
}
