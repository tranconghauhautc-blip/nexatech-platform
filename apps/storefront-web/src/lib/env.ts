/**
 * Ánh xạ tên service (dùng trong đường dẫn BFF `/api/bff/<service>/...`) sang
 * biến môi trường + giá trị fallback cho local dev không qua Kong Gateway.
 */
export const SERVICE_ENV_MAP = {
  identity: {
    envKey: 'IDENTITY_SERVICE_URL',
    fallback: 'http://localhost:3001',
  },
  customer: {
    envKey: 'CUSTOMER_SERVICE_URL',
    fallback: 'http://localhost:3002',
  },
  catalog: { envKey: 'CATALOG_SERVICE_URL', fallback: 'http://localhost:3003' },
  media: { envKey: 'MEDIA_SERVICE_URL', fallback: 'http://localhost:3004' },
  inventory: {
    envKey: 'INVENTORY_SERVICE_URL',
    fallback: 'http://localhost:3005',
  },
  cart: { envKey: 'CART_SERVICE_URL', fallback: 'http://localhost:3006' },
  order: { envKey: 'ORDER_SERVICE_URL', fallback: 'http://localhost:3007' },
  payment: { envKey: 'PAYMENT_SERVICE_URL', fallback: 'http://localhost:3008' },
  shipping: {
    envKey: 'SHIPPING_SERVICE_URL',
    fallback: 'http://localhost:3009',
  },
  review: { envKey: 'REVIEW_SERVICE_URL', fallback: 'http://localhost:3010' },
  warranty: {
    envKey: 'WARRANTY_SERVICE_URL',
    fallback: 'http://localhost:3011',
  },
  support: { envKey: 'SUPPORT_SERVICE_URL', fallback: 'http://localhost:3012' },
  notification: {
    envKey: 'NOTIFICATION_SERVICE_URL',
    fallback: 'http://localhost:3013',
  },
} as const;

export type ServiceName = keyof typeof SERVICE_ENV_MAP;

export const SERVICE_NAMES = Object.keys(SERVICE_ENV_MAP) as ServiceName[];

export function isServiceName(value: string): value is ServiceName {
  return Object.prototype.hasOwnProperty.call(SERVICE_ENV_MAP, value);
}

/**
 * Trả về base URL nội bộ (server-side) cho một service.
 * Ưu tiên `*_SERVICE_URL` (gọi thẳng microservice trong Docker).
 * Nếu không có, dùng `INTERNAL_API_BASE_URL` (Kong) với path `/api/v1/...`
 * (Kong không dùng prefix `/{service}`).
 */
export function getInternalServiceBaseUrl(service: ServiceName): string {
  const { envKey, fallback } = SERVICE_ENV_MAP[service];
  const value = process.env[envKey]?.trim();
  if (value && value.length > 0) {
    return value.replace(/\/+$/, '');
  }
  const gatewayBase = process.env['INTERNAL_API_BASE_URL']?.trim();
  if (gatewayBase) {
    return gatewayBase.replace(/\/+$/, '');
  }
  return fallback;
}

/** URL public (trình duyệt) tới media-service để hiển thị ảnh/video. */
export function getMediaPublicBaseUrl(): string {
  return (
    process.env['MEDIA_PUBLIC_BASE_URL']?.trim() || 'http://localhost:3004'
  );
}

/** URL gốc chính website storefront (dùng cho canonical, OG, sitemap). */
export function getAppBaseUrl(): string {
  return (
    process.env['APP_BASE_URL']?.trim() ||
    process.env['NEXT_PUBLIC_APP_BASE_URL']?.trim() ||
    'http://localhost:3000'
  );
}

/** Base URL public dùng cho gọi API trực tiếp từ trình duyệt (khi có Kong). */
export function getPublicApiBaseUrl(): string {
  return process.env['NEXT_PUBLIC_API_BASE_URL']?.trim() || '';
}

export function getGoogleOAuthClientId(): string {
  return process.env['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID']?.trim() || '';
}
