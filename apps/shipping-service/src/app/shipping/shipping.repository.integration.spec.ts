import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertIntegrationTestDatabaseReady,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';

/**
 * Integration suite gate. Requires SHIPPING_TEST_DATABASE_URL pointing at
 * nexatech_shipping_test only — never falls back to SHIPPING_DATABASE_URL.
 */
const SHIPPING_TEST_DB = {
  testUrlEnv: 'SHIPPING_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_shipping_test',
  runtimeUrlEnv: 'SHIPPING_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  SHIPPING_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('shipping prisma repository integration', () => {
  beforeAll(() => {
    assertIntegrationTestDatabaseReady(SHIPPING_TEST_DB);
  });

  it('connects when SHIPPING_TEST_DATABASE_URL is set', async () => {
    expect(process.env['SHIPPING_TEST_DATABASE_URL']).toBeTruthy();
  });
});

describe('shipping prisma migration files', () => {
  it('includes init migration sql', () => {
    const migration = join(
      __dirname,
      '../../../prisma/migrations/20260730020000_init_shipping/migration.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('CREATE TABLE "Shipment"');
    expect(sql).toContain('CREATE TABLE "ShippingQuote"');
    expect(sql).toContain('CREATE TABLE "DeliverySlot"');
  });
});
