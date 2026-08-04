import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertIntegrationTestDatabaseReady,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';

/**
 * Integration suite gate. Requires REVIEW_TEST_DATABASE_URL pointing at
 * nexatech_review_test only — never falls back to REVIEW_DATABASE_URL.
 */
const REVIEW_TEST_DB = {
  testUrlEnv: 'REVIEW_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_review_test',
  runtimeUrlEnv: 'REVIEW_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  REVIEW_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('review prisma repository integration', () => {
  beforeAll(() => {
    assertIntegrationTestDatabaseReady(REVIEW_TEST_DB);
  });

  it('connects when REVIEW_TEST_DATABASE_URL is set', async () => {
    expect(process.env['REVIEW_TEST_DATABASE_URL']).toBeTruthy();
  });
});

describe('review prisma migration files', () => {
  it('includes review entities', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730030000_init_review/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "ReviewMedia"');
    expect(sql).toContain('CREATE TABLE "ReviewReport"');
    expect(sql).toContain('CREATE TABLE "ReviewHelpfulVote"');
  });
});
