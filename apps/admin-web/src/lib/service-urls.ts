export type AdminServiceKey =
  | 'identity'
  | 'customer'
  | 'catalog'
  | 'inventory'
  | 'order'
  | 'payment'
  | 'shipping'
  | 'review'
  | 'warranty'
  | 'support'
  | 'notification'
  | 'reporting'
  | 'media';

interface ServiceConfig {
  envKey: string;
  fallback: string;
}

const SERVICE_CONFIG: Record<AdminServiceKey, ServiceConfig> = {
  identity: {
    envKey: 'IDENTITY_SERVICE_URL',
    fallback: 'http://localhost:3001',
  },
  customer: {
    envKey: 'CUSTOMER_SERVICE_URL',
    fallback: 'http://localhost:3002',
  },
  catalog: { envKey: 'CATALOG_SERVICE_URL', fallback: 'http://localhost:3003' },
  inventory: {
    envKey: 'INVENTORY_SERVICE_URL',
    fallback: 'http://localhost:3005',
  },
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
  reporting: {
    envKey: 'REPORTING_SERVICE_URL',
    fallback: 'http://localhost:3014',
  },
  media: { envKey: 'MEDIA_SERVICE_URL', fallback: 'http://localhost:3004' },
};

export const ADMIN_SERVICE_KEYS = Object.keys(
  SERVICE_CONFIG,
) as AdminServiceKey[];

export function isAdminServiceKey(value: string): value is AdminServiceKey {
  return Object.prototype.hasOwnProperty.call(SERVICE_CONFIG, value);
}

export function resolveServiceBaseUrl(service: AdminServiceKey): string {
  const config = SERVICE_CONFIG[service];
  const raw = process.env[config.envKey];
  const value = raw && raw.trim().length > 0 ? raw.trim() : config.fallback;
  return value.replace(/\/+$/, '');
}
