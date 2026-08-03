import * as Minio from 'minio';
import type {
  ObjectKeyParams,
  ObjectStorage,
  PresignGetParams,
  PresignPutParams,
} from './object-storage';

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
  /** Browser-reachable host used only when signing presigned URLs. */
  publicEndPoint?: string;
  publicPort?: number;
  publicUseSSL?: boolean;
}

function readMinioConfig(options?: { allowMissing?: boolean }): MinioConfig {
  const endPoint = process.env['MINIO_ENDPOINT'];
  const accessKey = process.env['MINIO_ACCESS_KEY'];
  const secretKey = process.env['MINIO_SECRET_KEY'];

  if (!endPoint || !accessKey || !secretKey) {
    if (options?.allowMissing) {
      return {
        endPoint: endPoint ?? 'localhost',
        port: Number(process.env['MINIO_PORT'] ?? 9000),
        useSSL: process.env['MINIO_USE_SSL'] === 'true',
        accessKey: accessKey ?? 'test',
        secretKey: secretKey ?? 'test',
        region: process.env['MINIO_REGION'] ?? 'us-east-1',
        publicEndPoint: process.env['MINIO_PUBLIC_ENDPOINT'],
        publicPort: process.env['MINIO_PUBLIC_PORT']
          ? Number(process.env['MINIO_PUBLIC_PORT'])
          : undefined,
        publicUseSSL: process.env['MINIO_PUBLIC_USE_SSL'] === 'true',
      };
    }
    throw new Error(
      'MINIO_ENDPOINT, MINIO_ACCESS_KEY và MINIO_SECRET_KEY bắt buộc khi dùng MinIO',
    );
  }

  return {
    endPoint,
    port: Number(process.env['MINIO_PORT'] ?? 9000),
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey,
    secretKey,
    region: process.env['MINIO_REGION'] ?? 'us-east-1',
    publicEndPoint: process.env['MINIO_PUBLIC_ENDPOINT'],
    publicPort: process.env['MINIO_PUBLIC_PORT']
      ? Number(process.env['MINIO_PUBLIC_PORT'])
      : undefined,
    publicUseSSL:
      process.env['MINIO_PUBLIC_USE_SSL'] !== undefined
        ? process.env['MINIO_PUBLIC_USE_SSL'] === 'true'
        : undefined,
  };
}

function createClient(config: {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region: string;
}): Minio.Client {
  return new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
  });
}

/**
 * Presign client must sign Host for a browser-reachable endpoint.
 * Internal Docker hostname (`minio`) must never appear in browser URLs.
 */
export function resolvePresignEndpoint(config: MinioConfig): {
  endPoint: string;
  port: number;
  useSSL: boolean;
} {
  const publicEndPoint = config.publicEndPoint?.trim();
  if (publicEndPoint) {
    return {
      endPoint: publicEndPoint,
      port: config.publicPort ?? config.port,
      useSSL: config.publicUseSSL ?? config.useSSL,
    };
  }
  return {
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
  };
}

export class MinioObjectStorage implements ObjectStorage {
  private readonly client: Minio.Client;
  private readonly presignClient: Minio.Client;
  private readonly region: string;
  readonly presignEndPoint: string;
  readonly presignPort: number;

  constructor(config?: MinioConfig) {
    const resolved = config ?? readMinioConfig();
    this.region = resolved.region ?? 'us-east-1';
    this.client = createClient({
      endPoint: resolved.endPoint,
      port: resolved.port,
      useSSL: resolved.useSSL,
      accessKey: resolved.accessKey,
      secretKey: resolved.secretKey,
      region: this.region,
    });
    const presign = resolvePresignEndpoint(resolved);
    this.presignEndPoint = presign.endPoint;
    this.presignPort = presign.port;
    this.presignClient = createClient({
      endPoint: presign.endPoint,
      port: presign.port,
      useSSL: presign.useSSL,
      accessKey: resolved.accessKey,
      secretKey: resolved.secretKey,
      region: this.region,
    });
  }

  async createPresignedPutUrl(params: PresignPutParams): Promise<string> {
    // Explicit region on the client avoids GetBucketLocation against the
    // public host (which may be unreachable from inside Docker).
    // Content-Type is included as a signed query param so the browser must
    // send the same MIME type that was validated at presign time.
    return this.presignClient.presignedUrl(
      'PUT',
      params.bucket,
      params.objectKey,
      params.expiresSeconds,
      { 'Content-Type': params.contentType },
    );
  }

  async createPresignedGetUrl(params: PresignGetParams): Promise<string> {
    return this.presignClient.presignedGetObject(
      params.bucket,
      params.objectKey,
      params.expiresSeconds,
    );
  }

  async removeObject(params: ObjectKeyParams): Promise<void> {
    await this.client.removeObject(params.bucket, params.objectKey);
  }

  async objectExists(params: ObjectKeyParams): Promise<boolean> {
    try {
      await this.client.statObject(params.bucket, params.objectKey);
      return true;
    } catch {
      return false;
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, this.region);
    }
  }
}

export { readMinioConfig };
