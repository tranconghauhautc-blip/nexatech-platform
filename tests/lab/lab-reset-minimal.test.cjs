const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DOMAIN_CLEAR_PLAN,
  MINIO_APP_BUCKETS,
  validateMinimalResetGuards,
  assertLocalDatabaseUrl,
  assertAllLocalDatabaseUrls,
  buildTruncateSql,
  expectedAccountEmails,
  assertPostResetIdentityCounts,
} = require('../../scripts/lib/lab-reset-minimal-core.cjs');

describe('lab-reset-minimal-core', () => {
  it('refuses outside local / without explicit reset gate', () => {
    assert.equal(
      validateMinimalResetGuards({
        NODE_ENV: 'production',
        NEXATECH_ALLOW_DEV_SEED: 'YES',
        NEXATECH_ALLOW_MINIMAL_RESET: 'YES',
        DEV_SEED_PASSWORD: 'NexaTechAccept1!',
      }).ok,
      false,
    );
    assert.equal(
      validateMinimalResetGuards({
        NODE_ENV: 'development',
        NEXATECH_ALLOW_DEV_SEED: 'YES',
        DEV_SEED_PASSWORD: 'NexaTechAccept1!',
      }).ok,
      false,
    );
  });

  it('accepts local guards when all gates are set', () => {
    const r = validateMinimalResetGuards({
      NODE_ENV: 'development',
      NEXATECH_ALLOW_DEV_SEED: 'YES',
      NEXATECH_ALLOW_MINIMAL_RESET: 'YES',
      DEV_SEED_PASSWORD: 'NexaTechAccept1!',
    });
    assert.equal(r.ok, true);
  });

  it('refuses non-local database hosts', () => {
    assert.equal(
      assertLocalDatabaseUrl(
        'IDENTITY_DATABASE_URL',
        'postgresql://u:p@prod-db.amazonaws.com:5432/db',
      ).ok,
      false,
    );
    assert.equal(
      assertLocalDatabaseUrl(
        'IDENTITY_DATABASE_URL',
        'postgresql://u:p@127.0.0.1:5432/nexatech_identity',
      ).ok,
      true,
    );
  });

  it('builds truncate SQL for domain tables', () => {
    const sql = buildTruncateSql(['Product', 'Brand']);
    assert.equal(sql.ok, true);
    assert.match(sql.sql, /TRUNCATE TABLE "Product", "Brand"/);
    assert.match(sql.sql, /RESTART IDENTITY CASCADE/);
  });

  it('plans clearing business DBs and retains MinIO app buckets list', () => {
    assert.ok(DOMAIN_CLEAR_PLAN.length >= 10);
    assert.ok(DOMAIN_CLEAR_PLAN.some((p) => p.database === 'nexatech_catalog'));
    assert.ok(DOMAIN_CLEAR_PLAN.some((p) => p.database === 'nexatech_media'));
    assert.deepEqual(MINIO_APP_BUCKETS.includes('product-media'), true);
  });

  it('expects exactly 4 internal + 2 customers', () => {
    const emails = expectedAccountEmails();
    assert.equal(emails.internalCount, 4);
    assert.equal(emails.customerCount, 2);
    const users = [...emails.internal, ...emails.customers].map((email) => ({
      email,
    }));
    assert.equal(assertPostResetIdentityCounts(users).ok, true);
    assert.equal(assertPostResetIdentityCounts(users.slice(0, 3)).ok, false);
  });

  it('assertAllLocalDatabaseUrls uses defaults for local lab', () => {
    const r = assertAllLocalDatabaseUrls({});
    assert.equal(r.ok, true);
  });
});
