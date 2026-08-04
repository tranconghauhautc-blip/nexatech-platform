/**
 * Regression: cart-service must fail-fast outside NODE_ENV=test when Redis /
 * catalog / inventory URLs are missing (no silent InMemory clients).
 */
describe('cart.module fail-fast providers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  async function loadModule() {
    return import('./cart.module');
  }

  it('loads CartModule in NODE_ENV=test without Redis/catalog/inventory URLs', async () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['REDIS_URL'];
    delete process.env['CATALOG_SERVICE_URL'];
    delete process.env['INVENTORY_SERVICE_URL'];
    delete process.env['CART_DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    delete process.env['RABBITMQ_URL'];
    const mod = await loadModule();
    expect(mod.CartModule).toBeDefined();
  });

  it('throws when REDIS_URL missing outside test', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['CART_DATABASE_URL'] =
      'postgresql://u:p@localhost:5432/nexatech_cart';
    process.env['RABBITMQ_URL'] = 'amqp://guest:guest@localhost:5672';
    process.env['CATALOG_SERVICE_URL'] = 'http://catalog:3003';
    process.env['INVENTORY_SERVICE_URL'] = 'http://inventory:3005';
    delete process.env['REDIS_URL'];
    await expect(loadModule()).rejects.toThrow(/REDIS_URL/);
  });

  it('throws when CATALOG_SERVICE_URL missing outside test', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['CART_DATABASE_URL'] =
      'postgresql://u:p@localhost:5432/nexatech_cart';
    process.env['RABBITMQ_URL'] = 'amqp://guest:guest@localhost:5672';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['INVENTORY_SERVICE_URL'] = 'http://inventory:3005';
    delete process.env['CATALOG_SERVICE_URL'];
    await expect(loadModule()).rejects.toThrow(/CATALOG_SERVICE_URL/);
  });

  it('throws when INVENTORY_SERVICE_URL missing outside test', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['CART_DATABASE_URL'] =
      'postgresql://u:p@localhost:5432/nexatech_cart';
    process.env['RABBITMQ_URL'] = 'amqp://guest:guest@localhost:5672';
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['CATALOG_SERVICE_URL'] = 'http://catalog:3003';
    delete process.env['INVENTORY_SERVICE_URL'];
    await expect(loadModule()).rejects.toThrow(/INVENTORY_SERVICE_URL/);
  });
});
