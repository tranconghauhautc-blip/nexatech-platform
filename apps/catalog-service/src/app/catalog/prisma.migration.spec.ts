import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  assertIntegrationTestDatabaseReady,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';
import { PrismaService } from './prisma.service';

const CATALOG_TEST_DB = {
  testUrlEnv: 'CATALOG_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_catalog_test',
  runtimeUrlEnv: 'CATALOG_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  CATALOG_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('catalog prisma migration', () => {
  const serviceDir = path.join(__dirname, '../../..');

  beforeAll(() => {
    assertIntegrationTestDatabaseReady(CATALOG_TEST_DB);
  });

  it('applies migrations successfully', () => {
    assertIntegrationTestDatabaseReady(CATALOG_TEST_DB);
    execSync('npx prisma migrate deploy', {
      cwd: serviceDir,
      env: process.env,
      stdio: 'pipe',
    });
  });

  it('records migration in _prisma_migrations', async () => {
    assertIntegrationTestDatabaseReady(CATALOG_TEST_DB);
    const prisma = new PrismaService();
    await prisma.$connect();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20260729120000_init_catalog'
    `;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await prisma.$disconnect();
  });
});
