import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('catalog_search');

export function setup() {
  const base = resolveBaseUrl();
  const catalogBase = (
    __ENV.CATALOG_BASE_URL || `${base.replace(/:\d+$/, '')}:3003`
  ).replace(/\/$/, '');
  return { catalogBase };
}

export default function (data) {
  const q = __ENV.SEARCH_Q || 'iphone';
  const res = getJson(
    `${data.catalogBase}/api/v1/products?page=1&limit=10&q=${encodeURIComponent(q)}`,
    {
      tags: { name: 'catalog_search' },
    },
  );
  okStatus(res, 'catalog_search');
  pace(0.4);
}
