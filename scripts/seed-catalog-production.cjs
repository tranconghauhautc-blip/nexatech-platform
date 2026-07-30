/**
 * Production-safe catalog seed wrapper (M18).
 *
 * Guards:
 *   - NODE_ENV must be 'production'
 *   - CONFIRM_PRODUCTION must be exactly 'YES'
 *   - CATALOG_DATABASE_URL required for execute
 *   - Rejects weak/default passwords in connection URL
 *   - --dry-run prints plan without calling seed
 *
 * Idempotent: delegates to scripts/seed-catalog.cjs (upserts).
 *
 * Usage:
 *   $env:NODE_ENV='production'
 *   $env:CONFIRM_PRODUCTION='YES'
 *   $env:CATALOG_DATABASE_URL='postgresql://nexatech_catalog:***@192.168.4.208:5432/nexatech_catalog?sslmode=prefer'
 *   node scripts/seed-catalog-production.cjs --dry-run
 *   node scripts/seed-catalog-production.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');

const WEAK_PASSWORD_PATTERNS = [
  /^changeme$/i,
  /^password$/i,
  /^123456$/,
  /^admin$/i,
  /^nexatech$/i,
  /^test$/i,
  /^default$/i,
  /^postgres$/i,
  /^root$/i,
  /^secret$/i,
  /^letmein$/i,
];

const WEAK_SUBSTRINGS = [
  'changeme',
  'password123',
  'admin123',
  'nexatech123',
  'your-password',
  'replace_me',
  'change-me',
  'CHANGE_ME',
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run') || argv.includes('-n'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function fail(message) {
  console.error(`[seed-catalog-production] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[seed-catalog-production] ${message}`);
}

function extractPasswordFromDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.password || '');
  } catch {
    const match = url.match(/:\/\/[^:]+:([^@]+)@/);
    return match ? decodeURIComponent(match[1]) : '';
  }
}

function isWeakPassword(password) {
  if (!password || password.length < 12) return true;
  for (const re of WEAK_PASSWORD_PATTERNS) {
    if (re.test(password)) return true;
  }
  const lower = password.toLowerCase();
  for (const sub of WEAK_SUBSTRINGS) {
    if (lower.includes(sub.toLowerCase())) return true;
  }
  return false;
}

function validateEnvironment(dryRun) {
  if (process.env.NODE_ENV !== 'production') {
    fail(
      'NODE_ENV must be "production" (refusing to run in dev/staging without explicit production flag).',
    );
  }

  if (process.env.CONFIRM_PRODUCTION !== 'YES') {
    fail(
      'CONFIRM_PRODUCTION must be exactly "YES". This script does not seed production by accident.',
    );
  }

  const dbUrl = process.env.CATALOG_DATABASE_URL;
  if (!dbUrl) {
    fail('CATALOG_DATABASE_URL is required.');
  }

  if (/localhost|127\.0\.0\.1/i.test(dbUrl) && !dryRun) {
    fail(
      'CATALOG_DATABASE_URL points to localhost — refusing production execute against local DB.',
    );
  }

  const password = extractPasswordFromDatabaseUrl(dbUrl);
  if (isWeakPassword(password)) {
    fail(
      'Database password in CATALOG_DATABASE_URL appears weak or default. Use a strong production password (min 12 chars, not changeme/password/etc.).',
    );
  }

  if (/changeme@|password@|:changeme|:password/i.test(dbUrl)) {
    fail('CATALOG_DATABASE_URL contains known weak credential patterns.');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage: node scripts/seed-catalog-production.cjs [--dry-run]

Environment:
  NODE_ENV=production
  CONFIRM_PRODUCTION=YES
  CATALOG_DATABASE_URL=postgresql://...

Delegates to scripts/seed-catalog.cjs (idempotent upserts ~100 catalog products).
Does NOT create admin users or weak passwords.`);
    process.exit(0);
  }

  validateEnvironment(args.dryRun);

  const seedScript = path.join(__dirname, 'seed-catalog.cjs');

  log(
    `NODE_ENV=${process.env.NODE_ENV} CONFIRM_PRODUCTION=${process.env.CONFIRM_PRODUCTION}`,
  );
  log(
    `Target DB host: ${(() => {
      try {
        return new URL(process.env.CATALOG_DATABASE_URL).hostname;
      } catch {
        return '(parse failed — check URL)';
      }
    })()}`,
  );

  if (args.dryRun) {
    log('DRY-RUN: would run seed-catalog.cjs with CATALOG_DATABASE_URL set.');
    log(
      'DRY-RUN: ~100 ACTIVE products via upsert (categories, brands, SKUs, prices).',
    );
    log('DRY-RUN: no admin/password seeding — catalog data only.');
    log('DRY-RUN complete. Pass without --dry-run to execute.');
    process.exit(0);
  }

  log('Executing idempotent catalog seed via seed-catalog.cjs ...');

  const result = spawnSync(process.execPath, [seedScript], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  if (result.status !== 0) {
    fail(`seed-catalog.cjs exited with code ${result.status ?? 'unknown'}`);
  }

  log('Production catalog seed completed successfully.');
}

main();
