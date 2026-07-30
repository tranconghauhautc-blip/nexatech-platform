import {
  defaultOptions,
  resolveBaseUrl,
  getJson,
  okStatus,
  pace,
} from './lib/helpers.js';

export const options = defaultOptions('catalog_listing');

export function setup() {
  const base = resolveBaseUrl();
  // Prefer direct catalog port when BASE_URL is entry VIP host-only
  const catalogBase =
    __ENV.CATALOG_BASE_URL || `${base.replace(/:\d+$/, '')}:3003`;
  return { catalogBase: catalogBase.replace(/\/$/, '') };
}

export default function (data) {
  const res = getJson(`${data.catalogBase}/api/v1/products?page=1&limit=20`, {
    tags: { name: 'catalog_list' },
  });
  okStatus(res, 'catalog_list');
  pace(0.3);
}
