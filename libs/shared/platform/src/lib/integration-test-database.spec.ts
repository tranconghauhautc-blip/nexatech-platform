import {
  assertIntegrationTestDatabaseReady,
  extractPostgresDatabaseName,
  resolveIntegrationTestDatabaseUrl,
} from './integration-test-database';

describe('extractPostgresDatabaseName', () => {
  it('parses database name from a standard Postgres URL', () => {
    expect(
      extractPostgresDatabaseName(
        'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order_test',
      ),
    ).toBe('nexatech_order_test');
  });

  it('strips query string from pathname', () => {
    expect(
      extractPostgresDatabaseName(
        'postgresql://u:p@localhost:5432/nexatech_cart_test?schema=public',
      ),
    ).toBe('nexatech_cart_test');
  });

  it('returns null for empty or invalid URLs', () => {
    expect(extractPostgresDatabaseName('')).toBeNull();
    expect(extractPostgresDatabaseName('not-a-url')).toBeNull();
  });
});

describe('resolveIntegrationTestDatabaseUrl', () => {
  const testUrlEnv = 'ORDER_TEST_DATABASE_URL';
  const runtimeUrlEnv = 'ORDER_DATABASE_URL';
  const requiredDatabaseName = 'nexatech_order_test';

  const originalTest = process.env[testUrlEnv];
  const originalRuntime = process.env[runtimeUrlEnv];
  const originalDatabase = process.env['DATABASE_URL'];

  afterEach(() => {
    if (originalTest === undefined) {
      delete process.env[testUrlEnv];
    } else {
      process.env[testUrlEnv] = originalTest;
    }
    if (originalRuntime === undefined) {
      delete process.env[runtimeUrlEnv];
    } else {
      process.env[runtimeUrlEnv] = originalRuntime;
    }
    if (originalDatabase === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabase;
    }
  });

  it('returns null when test URL env is unset (skip suite) and does not read runtime URL', () => {
    delete process.env[testUrlEnv];
    process.env[runtimeUrlEnv] =
      'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order';

    expect(
      resolveIntegrationTestDatabaseUrl({
        testUrlEnv,
        requiredDatabaseName,
        runtimeUrlEnv,
      }),
    ).toBeNull();
  });

  it('never falls back from missing test URL to ORDER_DATABASE_URL', () => {
    delete process.env[testUrlEnv];
    process.env[runtimeUrlEnv] =
      'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order_test';

    expect(
      resolveIntegrationTestDatabaseUrl({
        testUrlEnv,
        requiredDatabaseName,
        runtimeUrlEnv,
      }),
    ).toBeNull();
  });

  it('accepts a dedicated test database and wires the runtime env', () => {
    const testUrl =
      'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order_test';
    process.env[testUrlEnv] = testUrl;
    process.env[runtimeUrlEnv] =
      'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order';
    process.env['DATABASE_URL'] =
      'postgresql://postgres:changeme@localhost:5432/postgres';

    const resolved = resolveIntegrationTestDatabaseUrl({
      testUrlEnv,
      requiredDatabaseName,
      runtimeUrlEnv,
    });

    expect(resolved).toBe(testUrl);
    expect(process.env[runtimeUrlEnv]).toBe(testUrl);
    expect(process.env['DATABASE_URL']).toBeUndefined();
  });

  it('fail-fast when test URL points at the runtime/dev database name', () => {
    process.env[testUrlEnv] =
      'postgresql://nexatech_order:changeme@localhost:5432/nexatech_order';

    expect(() =>
      resolveIntegrationTestDatabaseUrl({
        testUrlEnv,
        requiredDatabaseName,
        runtimeUrlEnv,
      }),
    ).toThrow(/nexatech_order_test/);
  });
});

describe('assertIntegrationTestDatabaseReady', () => {
  const testUrlEnv = 'CART_TEST_DATABASE_URL';
  const runtimeUrlEnv = 'CART_DATABASE_URL';
  const requiredDatabaseName = 'nexatech_cart_test';

  const originalTest = process.env[testUrlEnv];
  const originalRuntime = process.env[runtimeUrlEnv];

  afterEach(() => {
    if (originalTest === undefined) {
      delete process.env[testUrlEnv];
    } else {
      process.env[testUrlEnv] = originalTest;
    }
    if (originalRuntime === undefined) {
      delete process.env[runtimeUrlEnv];
    } else {
      process.env[runtimeUrlEnv] = originalRuntime;
    }
  });

  it('throws before cleanup when test URL is missing', () => {
    delete process.env[testUrlEnv];
    expect(() =>
      assertIntegrationTestDatabaseReady({
        testUrlEnv,
        requiredDatabaseName,
        runtimeUrlEnv,
      }),
    ).toThrow(/Thiếu CART_TEST_DATABASE_URL/);
  });

  it('throws when URL is set to a non-test database', () => {
    process.env[testUrlEnv] =
      'postgresql://nexatech_cart:changeme@localhost:5432/nexatech_cart';
    expect(() =>
      assertIntegrationTestDatabaseReady({
        testUrlEnv,
        requiredDatabaseName,
        runtimeUrlEnv,
      }),
    ).toThrow(/nexatech_cart_test/);
  });
});
