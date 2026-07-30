export const BFF_SERVICE_ENV: Record<string, string> = {
  identity: 'IDENTITY_SERVICE_URL',
  customer: 'CUSTOMER_SERVICE_URL',
  catalog: 'CATALOG_SERVICE_URL',
  media: 'MEDIA_SERVICE_URL',
  inventory: 'INVENTORY_SERVICE_URL',
  cart: 'CART_SERVICE_URL',
  order: 'ORDER_SERVICE_URL',
  payment: 'PAYMENT_SERVICE_URL',
  shipping: 'SHIPPING_SERVICE_URL',
  review: 'REVIEW_SERVICE_URL',
  warranty: 'WARRANTY_SERVICE_URL',
  support: 'SUPPORT_SERVICE_URL',
  notification: 'NOTIFICATION_SERVICE_URL',
  reporting: 'REPORTING_SERVICE_URL',
};

export const DEFAULT_SERVICE_PORTS: Record<string, number> = {
  identity: 3001,
  customer: 3002,
  catalog: 3003,
  media: 3004,
  inventory: 3005,
  cart: 3006,
  order: 3007,
  payment: 3008,
  shipping: 3009,
  review: 3010,
  warranty: 3011,
  support: 3012,
  notification: 3013,
  reporting: 3014,
};

export function resolveServiceBaseUrl(service: string): string {
  const envKey = BFF_SERVICE_ENV[service];
  if (envKey) {
    const fromEnv = process.env[envKey];
    if (fromEnv && fromEnv.trim()) {
      return fromEnv.replace(/\/$/, '');
    }
  }
  const port = DEFAULT_SERVICE_PORTS[service];
  if (!port) {
    throw new Error(`Unknown BFF service: ${service}`);
  }
  return `http://127.0.0.1:${port}`;
}

export function getPublicApiBaseUrl(): string {
  return (
    process.env['NEXT_PUBLIC_API_BASE_URL']?.replace(/\/$/, '') || '/api/bff'
  );
}
