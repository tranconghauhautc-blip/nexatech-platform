#!/usr/bin/env node
/** Patch NestJS mains for graceful shutdown (idempotent). */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const services = [
  'identity-service',
  'customer-service',
  'catalog-service',
  'media-service',
  'inventory-service',
  'cart-service',
  'order-service',
  'payment-service',
  'shipping-service',
  'review-service',
  'warranty-service',
  'support-service',
  'notification-service',
  'reporting-service',
];
for (const name of services) {
  const mainPath = path.join(root, 'apps', name, 'src', 'main.ts');
  let src = fs.readFileSync(mainPath, 'utf8');
  if (src.includes('enableShutdownHooks')) {
    console.log('ok', name);
    continue;
  }
  const next = src.replace(
    /(const app = await NestFactory\.create\([^)]+\);)/,
    '$1\n  app.enableShutdownHooks();',
  );
  if (next === src) {
    console.warn('no match', name);
    continue;
  }
  fs.writeFileSync(mainPath, next, 'utf8');
  console.log('patched', name);
}
