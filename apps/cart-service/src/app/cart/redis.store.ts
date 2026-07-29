import { createHash, randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface CartRedisStore {
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  getIdempotency(key: string): Promise<unknown | null>;
  setIdempotency(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean>;
  acquireLock(key: string, ttlSeconds: number): Promise<string | null>;
  releaseLock(key: string, token: string): Promise<void>;
  setGuestTokenMeta(
    tokenHash: string,
    cartId: string,
    ttlSeconds: number,
  ): Promise<void>;
  deleteGuestTokenMeta(tokenHash: string): Promise<void>;
  ping(): Promise<boolean>;
  disconnect(): Promise<void>;
}

export class InMemoryCartRedisStore implements CartRedisStore {
  private readonly data = new Map<
    string,
    { value: string; expiresAt?: number }
  >();

  private isExpired(entry: { expiresAt?: number }): boolean {
    return entry.expiresAt !== undefined && entry.expiresAt <= Date.now();
  }

  private read(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }
    if (this.isExpired(entry)) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.read(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    this.data.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async getIdempotency(key: string): Promise<unknown | null> {
    return this.getJson(`idem:${key}`);
  }

  async setIdempotency(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const fullKey = `idem:${key}`;
    if (this.read(fullKey)) {
      return false;
    }
    await this.setJson(fullKey, value, ttlSeconds);
    return true;
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const fullKey = `lock:${key}`;
    if (this.read(fullKey)) {
      return null;
    }
    const token = randomBytes(16).toString('hex');
    this.data.set(fullKey, {
      value: token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return token;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const fullKey = `lock:${key}`;
    const current = this.read(fullKey);
    if (current === token) {
      this.data.delete(fullKey);
    }
  }

  async setGuestTokenMeta(
    tokenHash: string,
    cartId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.setJson(`guest:${tokenHash}`, { cartId }, ttlSeconds);
  }

  async deleteGuestTokenMeta(tokenHash: string): Promise<void> {
    this.data.delete(`guest:${tokenHash}`);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    this.data.clear();
  }
}

export class RedisCartStore implements CartRedisStore {
  private static readonly logger = new Logger(RedisCartStore.name);
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.ensureConnected();
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async getIdempotency(key: string): Promise<unknown | null> {
    return this.getJson(`cart:idem:${key}`);
  }

  async setIdempotency(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.set(
      `cart:idem:${key}`,
      JSON.stringify(value),
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    await this.ensureConnected();
    const token = randomBytes(16).toString('hex');
    const result = await this.client.set(
      `cart:lock:${key}`,
      token,
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.ensureConnected();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await this.client.eval(script, 1, `cart:lock:${key}`, token);
    } catch (error) {
      RedisCartStore.logger.warn(`releaseLock failed: ${String(error)}`);
    }
  }

  async setGuestTokenMeta(
    tokenHash: string,
    cartId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.setJson(`cart:guest:${tokenHash}`, { cartId }, ttlSeconds);
  }

  async deleteGuestTokenMeta(tokenHash: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(`cart:guest:${tokenHash}`);
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

export function hashCartToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateCartToken(): string {
  return randomBytes(32).toString('base64url');
}
