/**
 * Unit tests for DEV Customer seed guards / plans / isolation from internal accounts.
 * Run: node --test tests/seed/seed-customers.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const core = require(
  path.join(__dirname, '../../scripts/lib/seed-customers-core.cjs'),
);
const accountsCore = require(
  path.join(__dirname, '../../scripts/lib/seed-accounts-core.cjs'),
);

describe('seed-customers guards', () => {
  it('rejects production NODE_ENV', () => {
    const r = core.validateSeedGuards({
      NODE_ENV: 'production',
      NEXATECH_ALLOW_DEV_SEED: 'YES',
      DEV_SEED_PASSWORD: 'ValidPass123!',
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /production/i);
  });

  it('rejects missing acknowledgment', () => {
    const r = core.validateSeedGuards({
      NODE_ENV: 'development',
      NEXATECH_ALLOW_DEV_SEED: 'NO',
      DEV_SEED_PASSWORD: 'ValidPass123!',
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /NEXATECH_ALLOW_DEV_SEED/);
  });

  it('rejects missing password', () => {
    const r = core.validateSeedGuards({
      NODE_ENV: 'development',
      NEXATECH_ALLOW_DEV_SEED: 'YES',
      DEV_SEED_PASSWORD: '',
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /DEV_SEED_PASSWORD/);
  });

  it('accepts valid guards', () => {
    const r = core.validateSeedGuards({
      NODE_ENV: 'development',
      NEXATECH_ALLOW_DEV_SEED: 'YES',
      DEV_SEED_PASSWORD: 'ValidPass123!',
    });
    assert.equal(r.ok, true);
  });
});

describe('seed-customers database URLs', () => {
  it('requires both IDENTITY and CUSTOMER URLs', () => {
    assert.equal(
      core.assertDatabaseUrls({
        IDENTITY_DATABASE_URL:
          'postgresql://nexatech_identity:x@localhost:5432/nexatech_identity',
      }).ok,
      false,
    );
    assert.equal(
      core.assertDatabaseUrls({
        CUSTOMER_DATABASE_URL:
          'postgresql://nexatech_customer:x@localhost:5432/nexatech_customer',
      }).ok,
      false,
    );
  });

  it('accepts local URLs', () => {
    const r = core.assertDatabaseUrls({
      IDENTITY_DATABASE_URL:
        'postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity',
      CUSTOMER_DATABASE_URL:
        'postgresql://nexatech_customer:changeme@localhost:5432/nexatech_customer',
    });
    assert.equal(r.ok, true);
  });
});

describe('seed-customers account definition', () => {
  it('defines exactly 2 Customer accounts with expected emails/names', () => {
    assert.equal(core.DEV_CUSTOMERS.length, 2);
    assert.equal(core.validateCustomerSeedTargets().ok, true);
    assert.deepEqual(
      core.DEV_CUSTOMERS.map((c) => c.email),
      ['customer1@nexatech.local', 'customer2@nexatech.local'],
    );
    assert.deepEqual(
      core.DEV_CUSTOMERS.map((c) => c.fullName),
      ['Nguyễn Văn Test', 'Trần Thị Demo'],
    );
    for (const c of core.DEV_CUSTOMERS) {
      assert.equal(c.role, 'Customer');
      assert.equal(c.address.isDefault, true);
      assert.equal(core.isInternalEmail(c.email), false);
    }
  });

  it('does not overlap internal account emails', () => {
    for (const a of accountsCore.DEV_ACCOUNTS) {
      assert.equal(core.isInternalEmail(a.email), true);
    }
    for (const c of core.DEV_CUSTOMERS) {
      assert.equal(
        accountsCore.DEV_ACCOUNTS.some((a) => a.email === c.email),
        false,
      );
    }
  });
});

describe('seed-customers identity plan', () => {
  const customer = core.DEV_CUSTOMERS[0];
  const hash = '$2a$10$abcdefghijklmnopqrstuv';

  it('creates identity with ACTIVE, verified, Customer role, isDevSeed', () => {
    const plan = core.planIdentityUpsert(null, customer, hash, false);
    assert.equal(plan.action, 'create');
    assert.equal(plan.data.status, 'ACTIVE');
    assert.deepEqual(plan.data.roles, ['Customer']);
    assert.equal(plan.data.isDevSeed, true);
    assert.equal(plan.data.passwordHash, hash);
    assert.ok(plan.data.emailVerifiedAt instanceof Date);
  });

  it('updates without resetting password by default', () => {
    const existing = {
      email: customer.email,
      passwordHash: 'old-hash',
      emailVerifiedAt: new Date('2020-01-01'),
      roles: ['Customer'],
      status: 'DISABLED',
    };
    const plan = core.planIdentityUpsert(existing, customer, hash, false);
    assert.equal(plan.action, 'update');
    assert.equal(plan.preservePassword, true);
    assert.equal(plan.data.passwordHash, undefined);
    assert.equal(plan.data.status, 'ACTIVE');
    assert.deepEqual(plan.data.roles, ['Customer']);
  });

  it('resets password only when DEV_SEED_RESET_PASSWORD=YES', () => {
    assert.equal(core.shouldResetPassword({}), false);
    const existing = {
      email: customer.email,
      passwordHash: 'old-hash',
      emailVerifiedAt: new Date(),
    };
    const plan = core.planIdentityUpsert(existing, customer, hash, true);
    assert.equal(plan.action, 'update-with-password-reset');
    assert.equal(plan.data.passwordHash, hash);
  });

  it('refuses to modify internal accounts', () => {
    const plan = core.planIdentityUpsert(
      { email: 'admin@nexatech.local' },
      { ...customer, email: 'admin@nexatech.local' },
      hash,
      false,
    );
    assert.equal(plan.action, 'refuse-internal');
  });
});

describe('seed-customers profile plan', () => {
  const customer = core.DEV_CUSTOMERS[1];

  it('creates profile + default VN address', () => {
    const plan = core.planProfileUpsert(null, customer, 'user-uuid-1');
    assert.equal(plan.action, 'create');
    assert.equal(plan.profile.userId, 'user-uuid-1');
    assert.equal(plan.profile.fullName, 'Trần Thị Demo');
    assert.equal(plan.address.isDefault, true);
    assert.equal(plan.address.city, 'Hà Nội');
  });

  it('updates profile fields when profile exists', () => {
    const plan = core.planProfileUpsert(
      { id: 'profile-1', userId: 'user-uuid-1' },
      customer,
      'user-uuid-1',
    );
    assert.equal(plan.action, 'update');
    assert.equal(plan.profileId, 'profile-1');
    assert.equal(plan.profile.phone, customer.phone);
  });
});

describe('seed-customers hashing matches accounts core', () => {
  it('uses bcrypt cost 10', async () => {
    const password = 'ValidPass123!';
    const hash = await core.hashPassword(password);
    assert.match(hash, /^\$2[aby]?\$10\$/);
    assert.equal(await core.verifyPassword(password, hash), true);
  });
});
