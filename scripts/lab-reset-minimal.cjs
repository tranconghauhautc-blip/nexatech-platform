#!/usr/bin/env node
'use strict';

/**
 * Local-only minimal lab reset:
 *   - Clears business/transaction data across service DBs (keeps schemas + migrations)
 *   - Clears MinIO application objects
 *   - Flushes Redis DB 0 and purges RabbitMQ queues when reachable
 *   - Reseeds 4 internal + 2 customer accounts with complete profiles
 *
 * Guards:
 *   NODE_ENV !== production
 *   NEXATECH_ALLOW_DEV_SEED=YES
 *   NEXATECH_ALLOW_MINIMAL_RESET=YES
 *   DEV_SEED_PASSWORD=<operator-defined>
 *   Local DB hosts only
 *
 * PowerShell:
 *   $env:NODE_ENV="development"
 *   $env:NEXATECH_ALLOW_DEV_SEED="YES"
 *   $env:NEXATECH_ALLOW_MINIMAL_RESET="YES"
 *   $env:DEV_SEED_PASSWORD="<operator-defined-strong-password>"
 *   $env:DEV_SEED_RESET_PASSWORD="YES"
 *   pnpm lab:reset:minimal
 */
const { spawnSync } = require('child_process');
const path = require('path');
const {
  DOMAIN_CLEAR_PLAN,
  MINIO_APP_BUCKETS,
  validateMinimalResetGuards,
  assertAllLocalDatabaseUrls,
  buildTruncateSql,
  expectedAccountEmails,
  assertPostResetIdentityCounts,
} = require('./lib/lab-reset-minimal-core.cjs');

const ROOT = path.resolve(__dirname, '..');
const POSTGRES_CONTAINER =
  process.env.NEXATECH_POSTGRES_CONTAINER || 'docker-postgres-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';
const MINIO_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || '127.0.0.1';
const MINIO_PORT = Number(process.env.MINIO_PUBLIC_PORT || 9000);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const SKIP_RESTART = process.env.NEXATECH_RESET_SKIP_RESTART === 'YES';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'guest';
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || 'guest';

function die(message) {
  console.error(`[lab:reset:minimal] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[lab:reset:minimal] ${message}`);
}

function runPsql(database, sql) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    die(
      `psql ${database} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
  return result.stdout;
}

function tableExistsSql(tables) {
  const list = tables.map((t) => `'${t.replace(/'/g, "''")}'`).join(',');
  return `
SELECT count(*)::int AS n
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (${list});
`;
}

async function clearMinioBuckets() {
  const Minio = require('minio');
  const client = new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: false,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
    region: process.env.MINIO_REGION || 'us-east-1',
  });

  let removed = 0;
  for (const bucket of MINIO_APP_BUCKETS) {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      log(`MinIO bucket missing (skip): ${bucket}`);
      continue;
    }
    const objects = [];
    const stream = client.listObjectsV2(bucket, '', true);
    await new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj && obj.name) objects.push(obj.name);
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    for (let i = 0; i < objects.length; i += 100) {
      const chunk = objects.slice(i, i + 100);
      await client.removeObjects(bucket, chunk);
      removed += chunk.length;
    }
    log(`MinIO cleared ${objects.length} object(s) from ${bucket}`);
  }
  return removed;
}

async function clearRedis() {
  try {
    const Redis = require('ioredis');
    const redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.flushdb();
    await redis.quit();
    log('Redis FLUSHDB complete');
  } catch (err) {
    log(`Redis clear skipped: ${err.message}`);
  }
}

async function clearRabbitMq() {
  try {
    const amqp = require('amqplib');
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    const q = await ch.assertQueue('', { exclusive: true });
    // Management-less: purge known nexatech queues by listing via rabbitmqadmin if available.
    // Best-effort: use HTTP management API.
    await ch.close();
    await conn.close();
    void q;
  } catch (err) {
    log(`RabbitMQ connect probe: ${err.message}`);
  }

  try {
    const user = process.env.RABBITMQ_USER || RABBITMQ_USER;
    const pass = process.env.RABBITMQ_PASSWORD || RABBITMQ_PASSWORD;
    const base =
      process.env.RABBITMQ_MGMT_URL || 'http://127.0.0.1:15672/api/queues';
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');
    const res = await fetch(base, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      log(`RabbitMQ management list skipped status=${res.status}`);
      return;
    }
    const queues = await res.json();
    let purged = 0;
    for (const queue of queues) {
      const name = queue.name;
      const vhost = encodeURIComponent(queue.vhost || '/');
      if (!name || name.startsWith('amq.')) continue;
      const purgeUrl = `http://127.0.0.1:15672/api/queues/${vhost}/${encodeURIComponent(name)}/contents`;
      const del = await fetch(purgeUrl, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` },
      });
      if (del.ok || del.status === 204) purged += 1;
    }
    log(`RabbitMQ purged ${purged} queue(s)`);
  } catch (err) {
    log(`RabbitMQ purge skipped: ${err.message}`);
  }
}

function runSeed(scriptName) {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    NEXATECH_ALLOW_DEV_SEED: 'YES',
    DEV_SEED_RESET_PASSWORD: process.env.DEV_SEED_RESET_PASSWORD || 'YES',
    IDENTITY_DATABASE_URL:
      process.env.IDENTITY_DATABASE_URL ||
      'postgresql://nexatech_identity:changeme@127.0.0.1:5432/nexatech_identity',
    CUSTOMER_DATABASE_URL:
      process.env.CUSTOMER_DATABASE_URL ||
      'postgresql://nexatech_customer:changeme@127.0.0.1:5432/nexatech_customer',
  };
  const result = spawnSync('pnpm', ['run', scriptName], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) {
    die(
      `${scriptName} failed:\n${(result.stderr || result.stdout || '').slice(-2000)}`,
    );
  }
  log(`${scriptName} OK`);
}

function restartComposeServices() {
  if (SKIP_RESTART) {
    log('Skip service restart (NEXATECH_RESET_SKIP_RESTART=YES)');
    return;
  }
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
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'infra/docker/docker-compose.apps.yml',
      'restart',
      ...services,
    ],
    { cwd: ROOT, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    log(
      `Compose restart warning: ${(result.stderr || result.stdout || '').slice(0, 500)}`,
    );
  } else {
    log('Application services restarted');
  }
}

async function waitHealth(ports, timeoutMs = 90_000) {
  const start = Date.now();
  for (const port of ports) {
    let ok = false;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health/live`);
        if (res.ok) {
          ok = true;
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!ok) die(`Health check failed for port ${port}`);
    log(`Healthy :${port}`);
  }
}

function verifyCounts() {
  const identityOut = runPsql(
    'nexatech_identity',
    `SELECT email, roles::text, status, "fullName", ("emailVerifiedAt" IS NOT NULL) AS verified
     FROM "User" ORDER BY email;`,
  );
  log('Identity users:\n' + identityOut.trim());

  const userRows = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'nexatech_identity',
      '-t',
      '-A',
      '-F',
      '|',
      '-c',
      'SELECT email FROM "User" ORDER BY email;',
    ],
    { encoding: 'utf8' },
  );
  if (userRows.status !== 0) {
    die('Failed to list identity users for verification');
  }
  const users = userRows.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
  const check = assertPostResetIdentityCounts(users);
  if (!check.ok) die(check.message);

  const customerProfiles = runPsql(
    'nexatech_customer',
    `SELECT p."fullName", p.phone, (SELECT count(*) FROM "Address" a WHERE a."customerId"=p.id) AS addresses
     FROM "CustomerProfile" p ORDER BY p."fullName";`,
  );
  log('Customer profiles:\n' + customerProfiles.trim());

  const productCount = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'nexatech_catalog',
      '-t',
      '-A',
      '-c',
      'SELECT count(*) FROM "Product";',
    ],
    { encoding: 'utf8' },
  );
  const products = Number((productCount.stdout || '').trim());
  if (products !== 0) die(`Expected 0 products, got ${products}`);

  const mediaCount = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'nexatech_media',
      '-t',
      '-A',
      '-c',
      'SELECT count(*) FROM "MediaObject";',
    ],
    { encoding: 'utf8' },
  );
  const media = Number((mediaCount.stdout || '').trim());
  if (media !== 0) die(`Expected 0 media objects, got ${media}`);

  const expected = expectedAccountEmails();
  log(
    `Verified: ${expected.internalCount} internal + ${expected.customerCount} customers; catalog/media empty`,
  );
}

async function main() {
  const guard = validateMinimalResetGuards(process.env);
  if (!guard.ok) die(guard.message);

  const urls = assertAllLocalDatabaseUrls(process.env);
  if (!urls.ok) die(urls.message);

  const policy = require('./lib/seed-accounts-core.cjs').validatePasswordPolicy(
    guard.password,
  );
  if (!policy.ok) die(policy.message);

  log('Starting minimal local reset (schemas/migrations preserved)');

  for (const plan of DOMAIN_CLEAR_PLAN) {
    const exists = runPsql(plan.database, tableExistsSql(plan.tables));
    void exists;
    const sql = buildTruncateSql(plan.tables);
    if (!sql.ok) die(sql.message);
    runPsql(plan.database, sql.sql);
    log(`Cleared ${plan.database} (${plan.tables.length} tables)`);
  }

  const removed = await clearMinioBuckets();
  log(`MinIO removed ${removed} object(s) total`);

  await clearRedis();
  await clearRabbitMq();

  runSeed('seed:accounts');
  runSeed('seed:customers');

  restartComposeServices();
  await waitHealth([3001, 3002, 3003, 3004, 3005]);
  verifyCounts();

  log('DONE — minimal account-only baseline ready');
}

main().catch((err) => {
  die(err && err.message ? err.message : String(err));
});
