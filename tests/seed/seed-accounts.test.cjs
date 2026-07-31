/**
 * Unit tests for DEV account seed guards / policy / hashing / idempotency plan.
 * Run: node --test tests/seed/seed-accounts.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const core = require(
  path.join(__dirname, '../../scripts/lib/seed-accounts-core.cjs'),
);

describe('seed-accounts guards', () => {
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
    assert.equal(r.password, 'ValidPass123!');
  });
});

describe('seed-accounts password policy', () => {
  it('rejects short password', () => {
    assert.equal(core.validatePasswordPolicy('Ab1!short').ok, false);
  });
  it('rejects missing uppercase', () => {
    assert.equal(core.validatePasswordPolicy('validpass123!').ok, false);
  });
  it('rejects missing lowercase', () => {
    assert.equal(core.validatePasswordPolicy('VALIDPASS123!').ok, false);
  });
  it('rejects missing digit', () => {
    assert.equal(core.validatePasswordPolicy('ValidPassword!').ok, false);
  });
  it('rejects missing special', () => {
    assert.equal(core.validatePasswordPolicy('ValidPassword1').ok, false);
  });
  it('accepts strong password', () => {
    assert.equal(core.validatePasswordPolicy('ValidPass123!').ok, true);
  });
});

describe('seed-accounts hashing', () => {
  it('hashes with bcrypt cost 10 and verifies', async () => {
    const password = 'ValidPass123!';
    const hash = await core.hashPassword(password);
    assert.match(hash, /^\$2[aby]?\$10\$/);
    assert.equal(await core.verifyPassword(password, hash), true);
    assert.equal(await core.verifyPassword('wrong-password!', hash), false);
  });
});

describe('seed-accounts accounts definition', () => {
  it('defines exactly 4 internal roles and emails', () => {
    assert.equal(core.DEV_ACCOUNTS.length, 4);
    const emails = core.DEV_ACCOUNTS.map((a) => a.email);
    assert.deepEqual(emails, [
      'staff@nexatech.local',
      'manager@nexatech.local',
      'admin@nexatech.local',
      'superadmin@nexatech.local',
    ]);
    assert.deepEqual(
      core.DEV_ACCOUNTS.map((a) => a.role),
      ['Staff', 'Manager', 'Admin', 'SuperAdmin'],
    );
    for (const a of core.DEV_ACCOUNTS) {
      assert.match(a.fullName, /^DEV_SEED/);
    }
  });
});

describe('seed-accounts idempotency plan', () => {
  const account = core.DEV_ACCOUNTS[0];
  const hash = '$2a$10$abcdefghijklmnopqrstuv';

  it('creates when missing', () => {
    const plan = core.planAccountUpsert(null, account, hash, false);
    assert.equal(plan.action, 'create');
    assert.equal(plan.data.isDevSeed, true);
    assert.equal(plan.data.status, 'ACTIVE');
    assert.deepEqual(plan.data.roles, ['Staff']);
    assert.equal(plan.data.passwordHash, hash);
  });

  it('updates without resetting password by default', () => {
    const existing = {
      email: account.email,
      passwordHash: 'old-hash',
      emailVerifiedAt: new Date('2020-01-01'),
      roles: ['Customer'],
      status: 'DISABLED',
    };
    const plan = core.planAccountUpsert(existing, account, hash, false);
    assert.equal(plan.action, 'update');
    assert.equal(plan.preservePassword, true);
    assert.equal(plan.data.passwordHash, undefined);
    assert.deepEqual(plan.data.roles, ['Staff']);
    assert.equal(plan.data.status, 'ACTIVE');
    assert.equal(plan.data.isDevSeed, true);
  });

  it('resets password only when confirmed', () => {
    const existing = {
      email: account.email,
      passwordHash: 'old-hash',
      emailVerifiedAt: new Date(),
    };
    const plan = core.planAccountUpsert(existing, account, hash, true);
    assert.equal(plan.action, 'update-with-password-reset');
    assert.equal(plan.data.passwordHash, hash);
  });

  it('shouldResetPassword requires YES', () => {
    assert.equal(core.shouldResetPassword({}), false);
    assert.equal(
      core.shouldResetPassword({ DEV_SEED_RESET_PASSWORD: 'NO' }),
      false,
    );
    assert.equal(
      core.shouldResetPassword({ DEV_SEED_RESET_PASSWORD: 'YES' }),
      true,
    );
  });

  it('redacts password hint', () => {
    const hint = core.redactPasswordHint('ValidPass123!');
    assert.doesNotMatch(hint, /ValidPass123!/);
    assert.match(hint, /chars/);
  });
});
