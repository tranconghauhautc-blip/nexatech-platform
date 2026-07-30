import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('product_detail');

export function setup() {
  const base = resolveBaseUrl();
  const catalogBase = (
    __ENV.CATALOG_BASE_URL || `${base.replace(/:\d+$/, '')}:3003`
  ).replace(/\/$/, '');
  const slug = __ENV.PRODUCT_SLUG || '';
  return { catalogBase, slug };
}

export default function (data) {
  const path = data.slug
    ? `/api/v1/products/${encodeURIComponent(data.slug)}`
    : `/api/v1/products?page=1&limit=1`;
  const res = getJson(`${data.catalogBase}${path}`, {
    tags: { name: 'product_detail' },
  });
  okStatus(res, 'product_detail');
  pace(0.4);
}
