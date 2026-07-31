/**
 * DEV/local seed for 4 internal RBAC accounts (Staff, Manager, Admin, SuperAdmin).
 *
 * Guards (all required):
 *   - NODE_ENV !== production
 *   - NEXATECH_ALLOW_DEV_SEED=YES
 *   - DEV_SEED_PASSWORD=<operator-defined strong password>
 *
 * Optional:
 *   - DEV_SEED_RESET_PASSWORD=YES  — reset password on existing seeded accounts
 *   - IDENTITY_DATABASE_URL        — required for execute
 *
 * Idempotent: create once; on re-run update role/status/marker; never auto-reset password.
 * Does NOT seed Customer, does NOT touch other users, does NOT reset DB.
 *
 * PowerShell:
 *   $env:NODE_ENV="development"
 *   $env:NEXATECH_ALLOW_DEV_SEED="YES"
 *   $env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
 *   $env:IDENTITY_DATABASE_URL="postgresql://nexatech_identity:changeme@localhost:5432/nexatech_identity"
 *   pnpm seed:accounts
 */
const path = require('path');
const {
  DEV_ACCOUNTS,
  validateSeedGuards,
  validatePasswordPolicy,
  hashPassword,
  shouldResetPassword,
  planAccountUpsert,
  redactPasswordHint,
} = require('./lib/seed-accounts-core.cjs');

function die(message) {
  console.error(`[seed:accounts] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[seed:accounts] ${message}`);
}

function loadPrisma() {
  try {
    return require('../apps/identity-service/src/generated/prisma')
      .PrismaClient;
  } catch {
    try {
      return require('@prisma/client').PrismaClient;
    } catch {
      die(
        'Prisma client not found. Run: pnpm exec prisma generate --schema=apps/identity-service/prisma/schema.prisma',
      );
    }
  }
}

async function main() {
  const guard = validateSeedGuards(process.env);
  if (!guard.ok) die(guard.message);

  const policy = validatePasswordPolicy(guard.password);
  if (!policy.ok) die(policy.message);

  const databaseUrl = process.env.IDENTITY_DATABASE_URL;
  if (!databaseUrl) {
    die(
      'IDENTITY_DATABASE_URL is required (local identity DB only — never production).',
    );
  }

  // Soft refuse obvious production hostnames in URL
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    if (
      host.includes('prod') ||
      host.endsWith('.amazonaws.com') ||
      host.endsWith('.azure.com')
    ) {
      die(
        'IDENTITY_DATABASE_URL looks like a non-local/production host. Refusing.',
      );
    }
  } catch {
    die('IDENTITY_DATABASE_URL is not a valid URL.');
  }

  const resetRequested = shouldResetPassword(process.env);
  const passwordHash = await hashPassword(guard.password);
  const PrismaClient = loadPrisma();
  const prisma = new PrismaClient();

  const results = [];
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

      let row;
      if (plan.action === 'create') {
        row = await prisma.user.create({ data: plan.data });
      } else {
        row = await prisma.user.update({
          where: { email: account.email },
          data: plan.data,
        });
      }

      results.push({
        email: row.email,
        role: account.role,
        id: row.id,
        action: plan.action,
        isDevSeed: row.isDevSeed === true,
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  log(`Seeded ${results.length} internal accounts (domain nexatech.local).`);
  for (const r of results) {
    log(
      `  ${r.role.padEnd(11)} ${r.email}  action=${r.action}  id=${r.id.slice(0, 8)}…`,
    );
  }
  log(
    `Password: operator-defined DEV_SEED_PASSWORD ${redactPasswordHint(guard.password)} (not printed).`,
  );
  if (resetRequested) {
    log(
      'DEV_SEED_RESET_PASSWORD=YES — password hashes refreshed for seeded accounts.',
    );
  } else {
    log(
      'Existing account passwords preserved (set DEV_SEED_RESET_PASSWORD=YES to reset).',
    );
  }
  log('Customer accounts are NOT seeded. No other users were deleted.');
}

main().catch((err) => {
  console.error('[seed:accounts] FATAL:', err?.message || err);
  process.exit(1);
});
