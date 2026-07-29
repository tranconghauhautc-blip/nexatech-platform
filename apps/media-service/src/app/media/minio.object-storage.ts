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
  };
}

export class MinioObjectStorage implements ObjectStorage {
  private readonly client: Minio.Client;
  private readonly region: string;

  constructor(config?: MinioConfig) {
    const resolved = config ?? readMinioConfig();
    this.region = resolved.region ?? 'us-east-1';
    this.client = new Minio.Client({
      endPoint: resolved.endPoint,
      port: resolved.port,
      useSSL: resolved.useSSL,
      accessKey: resolved.accessKey,
      secretKey: resolved.secretKey,
      region: this.region,
    });
  }

  async createPresignedPutUrl(params: PresignPutParams): Promise<string> {
    return this.client.presignedPutObject(
      params.bucket,
      params.objectKey,
      params.expiresSeconds,
    );
  }

  async createPresignedGetUrl(params: PresignGetParams): Promise<string> {
    return this.client.presignedGetObject(
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
