import Redis from 'ioredis';
import {
  InMemoryCartRedisStore,
  RedisCartStore,
  generateCartToken,
  hashCartToken,
} from './redis.store';

describe('CartRedisStore (in-memory)', () => {
  it('supports idempotency NX semantics and locks', async () => {
    const store = new InMemoryCartRedisStore();
    const first = await store.setIdempotency('k1', { ok: true }, 60);
    const second = await store.setIdempotency('k1', { ok: false }, 60);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(await store.getIdempotency('k1')).toEqual({ ok: true });

    const token = await store.acquireLock('cart-1', 5);
    expect(token).toBeTruthy();
    if (!token) {
      throw new Error('missing lock token');
    }
    expect(await store.acquireLock('cart-1', 5)).toBeNull();
    await store.releaseLock('cart-1', token);
    expect(await store.acquireLock('cart-1', 5)).toBeTruthy();
  });

  it('hashes guest tokens stably', () => {
    const token = generateCartToken();
    expect(hashCartToken(token)).toBe(hashCartToken(token));
    expect(hashCartToken(token)).not.toBe(token);
  });
});

const redisUrl = process.env['REDIS_URL'];
const describeIfRedis = redisUrl ? describe : describe.skip;

describeIfRedis('CartRedisStore (redis integration)', () => {
  let store: RedisCartStore;

  beforeAll(() => {
    if (!redisUrl) {
      throw new Error('REDIS_URL required');
    }
    store = new RedisCartStore(redisUrl);
  });

  afterAll(async () => {
    await store.disconnect();
  });

  it('pings and stores idempotency keys', async () => {
    if (!redisUrl) {
      throw new Error('REDIS_URL required');
    }
    expect(await store.ping()).toBe(true);
    const key = `test-idem-${Date.now()}`;
    expect(await store.setIdempotency(key, { a: 1 }, 30)).toBe(true);
    expect(await store.setIdempotency(key, { a: 2 }, 30)).toBe(false);
    expect(await store.getIdempotency(key)).toEqual({ a: 1 });

    const client = new Redis(redisUrl);
    await client.del(`cart:idem:${key}`);
    await client.quit();
  });
});
