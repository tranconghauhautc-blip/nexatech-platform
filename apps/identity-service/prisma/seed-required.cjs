/**
 * Required-only deploy seed: Staff / Manager / Admin / SuperAdmin.
 * Does NOT seed products, SKUs, stock, orders, payments, or other business data.
 *
 * Guards:
 *   - NEXATECH_ALLOW_REQUIRED_SEED=YES
 *   - REQUIRED_SEED_PASSWORD or DEV_SEED_PASSWORD (operator-defined, never logged in full)
 *   - IDENTITY_DATABASE_URL
 *
 * Writes account emails (not passwords) to .secrets/seeded-accounts.txt
 */
const fs = require('fs');
const path = require('path');
const {
  DEV_ACCOUNTS,
  validatePasswordPolicy,
  hashPassword,
  planAccountUpsert,
  redactPasswordHint,
  shouldResetPassword,
} = require('../../../scripts/lib/seed-accounts-core.cjs');

function die(message) {
  console.error(`[seed-required] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[seed-required] ${message}`);
}

function validateRequiredSeedGuards(env = process.env) {
  if (env.NEXATECH_ALLOW_REQUIRED_SEED !== 'YES') {
    return {
      ok: false,
      message:
        'Set NEXATECH_ALLOW_REQUIRED_SEED=YES to run required account seed.',
    };
  }
  const password = env.REQUIRED_SEED_PASSWORD || env.DEV_SEED_PASSWORD;
  if (!password) {
    return {
      ok: false,
      message:
        'REQUIRED_SEED_PASSWORD (or DEV_SEED_PASSWORD) is required; never commit it.',
    };
  }
  if (!env.IDENTITY_DATABASE_URL) {
    return {
      ok: false,
      message: 'IDENTITY_DATABASE_URL is required.',
    };
  }
  return { ok: true, password: String(password) };
}

function loadPrisma() {
  try {
    return require('../src/generated/prisma').PrismaClient;
  } catch {
    try {
      return require('@prisma/client').PrismaClient;
    } catch {
      die(
        'Prisma client not found. Run prisma generate for identity-service first.',
      );
    }
  }
}

async function main() {
  const guard = validateRequiredSeedGuards(process.env);
  if (!guard.ok) die(guard.message);
  const policy = validatePasswordPolicy(guard.password);
  if (!policy.ok) die(policy.message);

  const resetRequested =
    process.env.REQUIRED_SEED_RESET_PASSWORD === 'YES' ||
    shouldResetPassword(process.env);
  const passwordHash = await hashPassword(guard.password);
  const PrismaClient = loadPrisma();
  const prisma = new PrismaClient();
  const emails = [];

  try {
    for (const account of DEV_ACCOUNTS) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
      });
      const plan = planAccountUpsert(
        existing,
        account,
        passwordHash,
        resetRequested,
      );
      if (plan.action === 'create') {
        await prisma.user.create({ data: plan.data });
        log(`created ${account.role}`);
      } else {
        await prisma.user.update({
          where: { email: account.email },
          data: plan.data,
        });
        log(`updated ${account.role} action=${plan.action}`);
      }
      emails.push(`${account.role}=${account.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  const secretsDir = path.resolve(__dirname, '../../../.secrets');
  fs.mkdirSync(secretsDir, { recursive: true });
  const out = path.join(secretsDir, 'seeded-accounts.txt');
  const body = [
    '# Seeded required accounts — DO NOT COMMIT',
    `# Generated: ${new Date().toISOString()}`,
    `# Password: operator-provided REQUIRED_SEED_PASSWORD ${redactPasswordHint(guard.password)}`,
    '# Full password is NOT stored in this file.',
    ...emails,
    '',
  ].join('\n');
  fs.writeFileSync(out, body, { encoding: 'utf8', flag: 'w' });
  log('account list written to .secrets/seeded-accounts.txt');
}

main().catch((err) => {
  die(err instanceof Error ? err.message : String(err));
});
