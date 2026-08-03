/**
 * Pure helpers for local minimal lab reset (testable without Docker/DB).
 * Clears business data; retains schema/migrations; reseeds accounts via seed scripts.
 */

const accountsCore = require('./seed-accounts-core.cjs');
const customersCore = require('./seed-customers-core.cjs');

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'host.docker.internal',
]);

/** Application MinIO buckets used by local Compose. */
const MINIO_APP_BUCKETS = [
  'product-media',
  'review-media',
  'support-attachments',
  'invoices',
  'misc',
];

/**
 * Truncate order: child tables first where FKs exist; TRUNCATE ... CASCADE
 * is preferred at execute time. Listed for documentation/assertions.
 */
const DOMAIN_CLEAR_PLAN = [
  {
    database: 'nexatech_catalog',
    tables: [
      'ProductMediaLink',
      'ProductSpecValue',
      'PriceHistory',
      'Price',
      'Sku',
      'Variant',
      'Product',
      'SpecAttribute',
      'SpecGroup',
      'SpecTemplate',
      'Brand',
      'Category',
    ],
    retainNote:
      'Categories/brands cleared — owner recreates via Admin UI. Not required for boot.',
  },
  {
    database: 'nexatech_media',
    tables: ['MediaLink', 'MediaAuditLog', 'MediaObject'],
  },
  {
    database: 'nexatech_inventory',
    tables: [
      'ReservationLine',
      'Reservation',
      'StockMovement',
      'StockItem',
      'Transfer',
      'IdempotencyRecord',
      'AuditLog',
      'Store',
      'Warehouse',
    ],
  },
  {
    database: 'nexatech_cart',
    tables: [
      'CartItem',
      'Cart',
      'WishlistItem',
      'ComparisonItem',
      'RecentlyViewedItem',
      'IdempotencyRecord',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_order',
    tables: [
      'OrderPackageItem',
      'OrderPackage',
      'OrderStatusHistory',
      'OrderAddressSnapshot',
      'OrderItem',
      'Order',
      'OrderIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_payment',
    tables: [
      'PaymentCallback',
      'PaymentTransaction',
      'PaymentAttempt',
      'Refund',
      'Payment',
      'PaymentIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_shipping',
    tables: [
      'TrackingEvent',
      'ShipmentStatusHistory',
      'ShipmentItem',
      'Shipment',
      'DeliverySlotReservation',
      'DeliverySlot',
      'ShippingQuote',
      'ProviderCallback',
      'ShipmentIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_review',
    tables: [
      'ReviewHelpfulVote',
      'ReviewReport',
      'ReviewModerationHistory',
      'ReviewReply',
      'ReviewMedia',
      'Review',
      'ProductRatingAggregate',
      'ReviewIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_warranty',
    tables: [
      'WarrantyClaimMedia',
      'WarrantyClaimHistory',
      'WarrantyClaim',
      'ReturnRequestMedia',
      'ReturnRequestHistory',
      'ReturnRequest',
      'WarrantyIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_support',
    tables: [
      'SupportTicketAttachment',
      'SupportTicketMessage',
      'SupportTicketHistory',
      'SupportTicket',
      'SupportIdempotency',
      'OutboxEvent',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_notification',
    tables: [
      'InAppNotification',
      'EmailDelivery',
      'ProcessedEvent',
      'NotificationIdempotency',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_reporting',
    tables: [
      'OrderProjection',
      'PaymentProjection',
      'ShipmentProjection',
      'ReviewProjection',
      'WarrantyClaimProjection',
      'WarrantyReturnProjection',
      'SupportTicketProjection',
      'DailyMetric',
      'AuditLogProjection',
      'ProcessedEvent',
      'ReportingIdempotency',
      'AuditLog',
    ],
  },
  {
    database: 'nexatech_customer',
    tables: ['Address', 'CustomerPreference', 'CustomerProfile'],
    reseed: 'seed:customers',
  },
  {
    database: 'nexatech_identity',
    tables: ['OtpChallenge', 'Session', 'Device', 'OAuthAccount', 'User'],
    reseed: 'seed:accounts + seed:customers',
    retainNote:
      'After truncate, reseeds 4 internal + 2 customer identity users only.',
  },
];

function fail(message) {
  return { ok: false, message };
}

function ok(data = {}) {
  return { ok: true, ...data };
}

/**
 * Refuse unless explicitly local lab.
 * Requires: NODE_ENV !== production, NEXATECH_ALLOW_DEV_SEED=YES,
 * NEXATECH_ALLOW_MINIMAL_RESET=YES, and local-looking DB hosts.
 */
function validateMinimalResetGuards(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? '';
  if (nodeEnv === 'production') {
    return fail(
      'Refusing: NODE_ENV=production. lab:reset:minimal is local/dev only.',
    );
  }
  if (env.NEXATECH_ALLOW_DEV_SEED !== 'YES') {
    return fail(
      'Refusing: set NEXATECH_ALLOW_DEV_SEED=YES (same gate as seed scripts).',
    );
  }
  if (env.NEXATECH_ALLOW_MINIMAL_RESET !== 'YES') {
    return fail(
      'Refusing: set NEXATECH_ALLOW_MINIMAL_RESET=YES to acknowledge destructive local data wipe.',
    );
  }
  const seedGuard = accountsCore.validateSeedGuards(env);
  if (!seedGuard.ok) {
    return fail(seedGuard.message);
  }
  return ok({ password: seedGuard.password });
}

function assertLocalDatabaseUrl(name, url) {
  if (!url) {
    return fail(`${name} is required for lab:reset:minimal.`);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return fail(`${name} is not a valid URL.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host.includes('prod') ||
    host.endsWith('.amazonaws.com') ||
    host.endsWith('.azure.com') ||
    host.endsWith('.googleapis.com')
  ) {
    return fail(`${name} looks like a non-local/production host. Refusing.`);
  }
  if (!LOCAL_HOSTS.has(host) && !host.endsWith('.local')) {
    return fail(
      `${name} host "${host}" is not in the local allow-list. Refusing.`,
    );
  }
  return ok({ host });
}

function assertAllLocalDatabaseUrls(env = process.env) {
  const urls = {
    IDENTITY_DATABASE_URL:
      env.IDENTITY_DATABASE_URL ||
      'postgresql://nexatech_identity:changeme@127.0.0.1:5432/nexatech_identity',
    CUSTOMER_DATABASE_URL:
      env.CUSTOMER_DATABASE_URL ||
      'postgresql://nexatech_customer:changeme@127.0.0.1:5432/nexatech_customer',
    CATALOG_DATABASE_URL:
      env.CATALOG_DATABASE_URL ||
      'postgresql://nexatech_catalog:changeme@127.0.0.1:5432/nexatech_catalog',
    MEDIA_DATABASE_URL:
      env.MEDIA_DATABASE_URL ||
      'postgresql://nexatech_media:changeme@127.0.0.1:5432/nexatech_media',
  };
  for (const [name, url] of Object.entries(urls)) {
    const check = assertLocalDatabaseUrl(name, url);
    if (!check.ok) return check;
  }
  return ok({ urls });
}

function buildTruncateSql(tables) {
  if (!Array.isArray(tables) || tables.length === 0) {
    return fail('tables required');
  }
  const quoted = tables.map((t) => `"${String(t).replace(/"/g, '')}"`);
  return ok({
    sql: `TRUNCATE TABLE ${quoted.join(', ')} RESTART IDENTITY CASCADE;`,
  });
}

function expectedAccountEmails() {
  return {
    internal: accountsCore.DEV_ACCOUNTS.map((a) => a.email),
    customers: customersCore.DEV_CUSTOMERS.map((c) => c.email),
    internalCount: accountsCore.DEV_ACCOUNTS.length,
    customerCount: customersCore.DEV_CUSTOMERS.length,
  };
}

function assertPostResetIdentityCounts(users) {
  const emails = expectedAccountEmails();
  const list = Array.isArray(users) ? users : [];
  const customerEmails = new Set(emails.customers.map((e) => e.toLowerCase()));
  const internalEmails = new Set(emails.internal.map((e) => e.toLowerCase()));
  const customers = list.filter((u) =>
    customerEmails.has(String(u.email || '').toLowerCase()),
  );
  const internals = list.filter((u) =>
    internalEmails.has(String(u.email || '').toLowerCase()),
  );
  if (list.length !== emails.internalCount + emails.customerCount) {
    return fail(
      `Expected ${emails.internalCount + emails.customerCount} users, got ${list.length}`,
    );
  }
  if (customers.length !== emails.customerCount) {
    return fail(
      `Expected ${emails.customerCount} customers, got ${customers.length}`,
    );
  }
  if (internals.length !== emails.internalCount) {
    return fail(
      `Expected ${emails.internalCount} internal accounts, got ${internals.length}`,
    );
  }
  return ok({
    total: list.length,
    internalCount: internals.length,
    customerCount: customers.length,
  });
}

module.exports = {
  DOMAIN_CLEAR_PLAN,
  MINIO_APP_BUCKETS,
  LOCAL_HOSTS,
  validateMinimalResetGuards,
  assertLocalDatabaseUrl,
  assertAllLocalDatabaseUrls,
  buildTruncateSql,
  expectedAccountEmails,
  assertPostResetIdentityCounts,
  DEV_ACCOUNTS: accountsCore.DEV_ACCOUNTS,
  DEV_CUSTOMERS: customersCore.DEV_CUSTOMERS,
};
