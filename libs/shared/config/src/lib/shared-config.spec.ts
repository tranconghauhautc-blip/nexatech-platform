import {
  ConfigValidationError,
  loadServiceBaseEnv,
  serviceBaseEnvSchema,
} from './shared-config';

describe('shared-config', () => {
  it('loads valid service base env with defaults', () => {
    const env = loadServiceBaseEnv({
      SERVICE_NAME: 'identity-service',
      DATABASE_URL:
        'postgresql://nexatech:secret@localhost:5432/nexatech_identity',
    });

    expect(env.SERVICE_NAME).toBe('identity-service');
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('rejects missing required variables', () => {
    expect(() => loadServiceBaseEnv({ PORT: '3001' })).toThrow(
      ConfigValidationError,
    );
  });

  it('parses custom schema fields', () => {
    const parsed = serviceBaseEnvSchema.parse({
      SERVICE_NAME: 'cart-service',
      DATABASE_URL: 'postgresql://localhost/db',
      PORT: '4010',
      NODE_ENV: 'test',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(parsed.PORT).toBe(4010);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.REDIS_URL).toBe('redis://localhost:6379');
  });
});
