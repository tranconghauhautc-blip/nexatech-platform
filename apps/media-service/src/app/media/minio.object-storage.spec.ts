import {
  resolvePresignEndpoint,
  readMinioConfig,
} from './minio.object-storage';

describe('MinioObjectStorage public presign endpoint', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('uses MINIO_PUBLIC_ENDPOINT for browser-reachable Host signing', () => {
    const resolved = resolvePresignEndpoint({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'k',
      secretKey: 's',
      publicEndPoint: 'localhost',
      publicPort: 9000,
      publicUseSSL: false,
    });
    expect(resolved.endPoint).toBe('localhost');
    expect(resolved.port).toBe(9000);
  });

  it('falls back to internal endpoint when public is unset', () => {
    const resolved = resolvePresignEndpoint({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'k',
      secretKey: 's',
    });
    expect(resolved.endPoint).toBe('minio');
  });

  it('readMinioConfig picks up public endpoint env vars', () => {
    process.env['MINIO_ENDPOINT'] = 'minio';
    process.env['MINIO_ACCESS_KEY'] = 'minioadmin';
    process.env['MINIO_SECRET_KEY'] = 'minioadmin';
    process.env['MINIO_PUBLIC_ENDPOINT'] = 'localhost';
    process.env['MINIO_PUBLIC_PORT'] = '9000';
    const cfg = readMinioConfig();
    expect(cfg.publicEndPoint).toBe('localhost');
    expect(cfg.publicPort).toBe(9000);
  });
});
