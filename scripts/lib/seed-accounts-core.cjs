/**
 * Pure helpers for DEV internal account seed (testable without DB).
 * Password hashing matches identity-service: bcryptjs cost 10.
 */
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
const EMAIL_DOMAIN = 'nexatech.local';

/** Canonical RBAC roles (PascalCase) — matches @nexatech/shared-auth */
const DEV_ACCOUNTS = [
  {
    role: 'Staff',
    email: `staff@${EMAIL_DOMAIN}`,
    fullName: 'DEV_SEED Staff',
  },
  {
    role: 'Manager',
    email: `manager@${EMAIL_DOMAIN}`,
    fullName: 'DEV_SEED Manager',
  },
  {
    role: 'Admin',
    email: `admin@${EMAIL_DOMAIN}`,
    fullName: 'DEV_SEED Admin',
  },
  {
    role: 'SuperAdmin',
    email: `superadmin@${EMAIL_DOMAIN}`,
    fullName: 'DEV_SEED Super Admin',
  },
];

function fail(message) {
  return { ok: false, message };
}

function ok(data) {
  return { ok: true, ...data };
}

/**
 * Gate: NODE_ENV !== production, NEXATECH_ALLOW_DEV_SEED=YES, DEV_SEED_PASSWORD set.
 */
function validateSeedGuards(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? '';
  if (nodeEnv === 'production') {
    return fail(
      'Refusing to run: NODE_ENV=production. Dev account seed is local/dev only.',
    );
  }
  if (env.NEXATECH_ALLOW_DEV_SEED !== 'YES') {
    return fail(
      'Refusing to run: set NEXATECH_ALLOW_DEV_SEED=YES to acknowledge intentional local seed.',
    );
  }
  const password = env.DEV_SEED_PASSWORD;
  if (password === undefined || password === null || String(password) === '') {
    return fail(
      'Refusing to run: DEV_SEED_PASSWORD is required (operator-defined; never commit it).',
    );
  }
  return ok({ password: String(password) });
}

/**
 * Password policy: min 12, upper, lower, digit, special.
 * Does not echo the password.
 */
function validatePasswordPolicy(password) {
  if (typeof password !== 'string') {
    return fail('DEV_SEED_PASSWORD must be a string.');
  }
  if (password.length < 12) {
    return fail('DEV_SEED_PASSWORD must be at least 12 characters.');
  }
  if (!/[A-Z]/.test(password)) {
    return fail('DEV_SEED_PASSWORD must contain an uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    return fail('DEV_SEED_PASSWORD must contain a lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    return fail('DEV_SEED_PASSWORD must contain a digit.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return fail('DEV_SEED_PASSWORD must contain a special character.');
  }
  return ok({});
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function shouldResetPassword(env = process.env) {
  return env.DEV_SEED_RESET_PASSWORD === 'YES';
}

/**
 * Decide create vs update fields for one account (idempotent).
 * Never changes password on update unless resetRequested.
 */
function planAccountUpsert(existing, account, passwordHash, resetRequested) {
  if (!existing) {
    return {
      action: 'create',
      data: {
        email: account.email,
        fullName: account.fullName,
        passwordHash,
        roles: [account.role],
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        isDevSeed: true,
      },
    };
  }

  const update = {
    fullName: account.fullName,
    roles: [account.role],
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

function redactPasswordHint(password) {
  if (!password || password.length < 4) return '[redacted]';
  return `${password.slice(0, 2)}…(${password.length} chars)`;
}

module.exports = {
  BCRYPT_ROUNDS,
  EMAIL_DOMAIN,
  DEV_ACCOUNTS,
  validateSeedGuards,
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  shouldResetPassword,
  planAccountUpsert,
  redactPasswordHint,
};
