/**
 * Pure helpers for DEV Customer seed (testable without DB).
 * Reuses guards/hashing from seed-accounts-core (identity bcrypt cost 10).
 * Does NOT touch internal Staff/Manager/Admin/SuperAdmin accounts.
 */
const accountsCore = require('./seed-accounts-core.cjs');

const EMAIL_DOMAIN = accountsCore.EMAIL_DOMAIN;

/** Exactly two Storefront Customer seed accounts. Role matches @nexatech/shared-auth Roles.Customer. */
const DEV_CUSTOMERS = [
  {
    key: 'customer1',
    email: `customer1@${EMAIL_DOMAIN}`,
    fullName: 'Nguyễn Văn Test',
    role: 'Customer',
    phone: '0901000001',
    address: {
      label: 'Nhà',
      recipient: 'Nguyễn Văn Test',
      phone: '0901000001',
      line1: '123 Đường Nguyễn Huệ',
      line2: null,
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'Hồ Chí Minh',
      postalCode: '700000',
      isDefault: true,
    },
  },
  {
    key: 'customer2',
    email: `customer2@${EMAIL_DOMAIN}`,
    fullName: 'Trần Thị Demo',
    role: 'Customer',
    phone: '0901000002',
    address: {
      label: 'Nhà',
      recipient: 'Trần Thị Demo',
      phone: '0901000002',
      line1: '456 Phố Huế',
      line2: null,
      ward: 'Phố Huế',
      district: 'Hai Bà Trưng',
      city: 'Hà Nội',
      postalCode: '100000',
      isDefault: true,
    },
  },
];

const INTERNAL_EMAILS = new Set(
  accountsCore.DEV_ACCOUNTS.map((a) => a.email.toLowerCase()),
);

function fail(message) {
  return { ok: false, message };
}

function ok(data = {}) {
  return { ok: true, ...data };
}

function isInternalEmail(email) {
  return INTERNAL_EMAILS.has(String(email || '').toLowerCase());
}

function validateCustomerSeedTargets() {
  if (DEV_CUSTOMERS.length !== 2) {
    return fail('DEV_CUSTOMERS must define exactly 2 accounts.');
  }
  for (const c of DEV_CUSTOMERS) {
    if (isInternalEmail(c.email)) {
      return fail(`Refusing: ${c.email} overlaps an internal seed account.`);
    }
    if (c.role !== 'Customer') {
      return fail(`Refusing: ${c.email} role must be Customer (got ${c.role}).`);
    }
  }
  return ok();
}

/**
 * Identity User upsert plan — same password rules as seed:accounts.
 */
function planIdentityUpsert(existing, customer, passwordHash, resetRequested) {
  if (existing && isInternalEmail(existing.email)) {
    return {
      action: 'refuse-internal',
      message: `Refusing to modify internal account ${existing.email}`,
    };
  }

  if (!existing) {
    return {
      action: 'create',
      data: {
        email: customer.email,
        fullName: customer.fullName,
        passwordHash,
        roles: [customer.role],
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        isDevSeed: true,
      },
    };
  }

  const update = {
    fullName: customer.fullName,
    roles: [customer.role],
    status: 'ACTIVE',
    emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
    isDevSeed: true,
  };
  if (resetRequested) {
    update.passwordHash = passwordHash;
  }
  return {
    action: resetRequested ? 'update-with-password-reset' : 'update',
    data: update,
    preservePassword: !resetRequested,
  };
}

/**
 * CustomerProfile + default Address plan (customer DB has no isDevSeed column).
 */
function planProfileUpsert(existingProfile, customer, userId) {
  const profileData = {
    userId,
    fullName: customer.fullName,
    phone: customer.phone,
  };
  const addressData = {
    label: customer.address.label,
    recipient: customer.address.recipient,
    phone: customer.address.phone,
    line1: customer.address.line1,
    line2: customer.address.line2,
    ward: customer.address.ward,
    district: customer.address.district,
    city: customer.address.city,
    postalCode: customer.address.postalCode,
    isDefault: customer.address.isDefault !== false,
  };

  if (!existingProfile) {
    return {
      action: 'create',
      profile: profileData,
      address: addressData,
    };
  }

  return {
    action: 'update',
    profileId: existingProfile.id,
    profile: {
      fullName: customer.fullName,
      phone: customer.phone,
    },
    address: addressData,
  };
}

function assertDatabaseUrls(env = process.env) {
  const identityUrl = env.IDENTITY_DATABASE_URL;
  const customerUrl = env.CUSTOMER_DATABASE_URL;
  if (!identityUrl) {
    return fail(
      'IDENTITY_DATABASE_URL is required (local identity DB — never production).',
    );
  }
  if (!customerUrl) {
    return fail(
      'CUSTOMER_DATABASE_URL is required (local customer DB — never production).',
    );
  }
  for (const [name, url] of [
    ['IDENTITY_DATABASE_URL', identityUrl],
    ['CUSTOMER_DATABASE_URL', customerUrl],
  ]) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (
        host.includes('prod') ||
        host.endsWith('.amazonaws.com') ||
        host.endsWith('.azure.com')
      ) {
        return fail(`${name} looks like a non-local/production host. Refusing.`);
      }
    } catch {
      return fail(`${name} is not a valid URL.`);
    }
  }
  return ok({ identityUrl, customerUrl });
}

module.exports = {
  EMAIL_DOMAIN,
  DEV_CUSTOMERS,
  INTERNAL_EMAILS,
  isInternalEmail,
  validateCustomerSeedTargets,
  planIdentityUpsert,
  planProfileUpsert,
  assertDatabaseUrls,
  validateSeedGuards: accountsCore.validateSeedGuards,
  validatePasswordPolicy: accountsCore.validatePasswordPolicy,
  hashPassword: accountsCore.hashPassword,
  verifyPassword: accountsCore.verifyPassword,
  shouldResetPassword: accountsCore.shouldResetPassword,
  redactPasswordHint: accountsCore.redactPasswordHint,
  DEV_ACCOUNTS: accountsCore.DEV_ACCOUNTS,
};
