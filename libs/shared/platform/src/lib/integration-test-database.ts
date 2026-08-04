/**
 * Guards for Prisma repository / migration integration suites.
 *
 * Destructive tests (deleteMany, migrate deploy against a live DB) MUST only
 * run against an explicit *_TEST_DATABASE_URL whose database name is a
 * dedicated test database (e.g. nexatech_order_test). Never fall back to the
 * runtime service URL (ORDER_DATABASE_URL / CATALOG_DATABASE_URL / …).
 */

export interface IntegrationTestDatabaseOptions {
  /** Env holding the test-only URL, e.g. `ORDER_TEST_DATABASE_URL`. */
  testUrlEnv: string;
  /** Exact Postgres database name required, e.g. `nexatech_order_test`. */
  requiredDatabaseName: string;
  /**
   * Runtime env that PrismaService / `prisma migrate` reads
   * (e.g. `ORDER_DATABASE_URL`). After a successful guard, this is overwritten
   * with the validated test URL so the process connects to the test DB.
   * It is NEVER used as a source/fallback for the test URL itself.
   */
  runtimeUrlEnv: string;
}

/** Extract the Postgres database name from a connection URL. */
export function extractPostgresDatabaseName(
  connectionUrl: string,
): string | null {
  const trimmed = connectionUrl.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const raw = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const name = raw.split('/')[0]?.split('?')[0]?.trim();
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

function readTestUrlOnly(testUrlEnv: string): string | null {
  const value = process.env[testUrlEnv];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertDatabaseNameIsSafe(
  databaseName: string,
  requiredDatabaseName: string,
  testUrlEnv: string,
): void {
  if (!requiredDatabaseName.endsWith('_test')) {
    throw new Error(
      `requiredDatabaseName "${requiredDatabaseName}" phải kết thúc bằng "_test"`,
    );
  }
  if (databaseName !== requiredDatabaseName) {
    throw new Error(
      `[integration-test-db] ${testUrlEnv} trỏ tới database "${databaseName}" ` +
        `— bắt buộc đúng "${requiredDatabaseName}". ` +
        `Không chạy cleanup/deleteMany trên database dev/runtime.`,
    );
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `[integration-test-db] database "${databaseName}" không phải DB test (*_test)`,
    );
  }
}

/**
 * Wire Prisma runtime env to the validated test URL and clear generic
 * DATABASE_URL so constructors cannot accidentally fall back to it.
 */
function wireRuntimeEnvToTestUrl(runtimeUrlEnv: string, testUrl: string): void {
  process.env[runtimeUrlEnv] = testUrl;
  delete process.env['DATABASE_URL'];
}

/**
 * Resolve a dedicated integration-test database URL.
 *
 * - Reads ONLY `testUrlEnv` — never falls back to `runtimeUrlEnv` / DATABASE_URL.
 * - Returns `null` when the test URL env is unset → caller should `describe.skip`.
 * - Throws when the URL is set but the database name is not the required *_test name.
 * - On success, wires `runtimeUrlEnv` to the test URL for PrismaService / migrate.
 */
export function resolveIntegrationTestDatabaseUrl(
  options: IntegrationTestDatabaseOptions,
): string | null {
  const testUrl = readTestUrlOnly(options.testUrlEnv);
  if (!testUrl) {
    return null;
  }

  const databaseName = extractPostgresDatabaseName(testUrl);
  if (!databaseName) {
    throw new Error(
      `[integration-test-db] Không parse được tên database từ ${options.testUrlEnv}`,
    );
  }

  assertDatabaseNameIsSafe(
    databaseName,
    options.requiredDatabaseName,
    options.testUrlEnv,
  );

  wireRuntimeEnvToTestUrl(options.runtimeUrlEnv, testUrl);
  return testUrl;
}

/**
 * Fail-fast guard for destructive hooks (beforeEach deleteMany, migrate deploy).
 * Always throws when the suite should not touch a database — never returns null.
 */
export function assertIntegrationTestDatabaseReady(
  options: IntegrationTestDatabaseOptions,
): string {
  const testUrl = readTestUrlOnly(options.testUrlEnv);
  if (!testUrl) {
    throw new Error(
      `[integration-test-db] Thiếu ${options.testUrlEnv}. ` +
        `Không chạy destructive integration test khi chưa có DB test riêng ` +
        `(ví dụ ${options.requiredDatabaseName}).`,
    );
  }

  const databaseName = extractPostgresDatabaseName(testUrl);
  if (!databaseName) {
    throw new Error(
      `[integration-test-db] Không parse được tên database từ ${options.testUrlEnv}`,
    );
  }

  assertDatabaseNameIsSafe(
    databaseName,
    options.requiredDatabaseName,
    options.testUrlEnv,
  );

  wireRuntimeEnvToTestUrl(options.runtimeUrlEnv, testUrl);
  return testUrl;
}

/**
 * True when the dedicated test URL env is set (non-empty).
 * Use with Jest: `const describeIfDb = shouldRunIntegrationDatabaseSuite(...) ? describe : describe.skip`.
 * Presence alone does not prove safety — call `assertIntegrationTestDatabaseReady`
 * inside beforeAll/beforeEach before any deleteMany / migrate.
 */
export function shouldRunIntegrationDatabaseSuite(testUrlEnv: string): boolean {
  return readTestUrlOnly(testUrlEnv) !== null;
}
