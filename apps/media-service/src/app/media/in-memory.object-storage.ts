import type {
  ObjectKeyParams,
  ObjectStorage,
  PresignGetParams,
  PresignPutParams,
} from './object-storage';

interface StoredObject {
  bucket: string;
  objectKey: string;
  contentType: string;
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();
  readonly uploadedKeys: string[] = [];
  readonly removedKeys: string[] = [];
  readonly ensuredBuckets = new Set<string>();

  private key(params: ObjectKeyParams): string {
    return `${params.bucket}/${params.objectKey}`;
  }

  async createPresignedPutUrl(params: PresignPutParams): Promise<string> {
    const storageKey = this.key(params);
    this.objects.set(storageKey, {
      bucket: params.bucket,
      objectKey: params.objectKey,
      contentType: params.contentType,
    });
    this.uploadedKeys.push(storageKey);
    return `http://inmemory/put/${params.bucket}/${params.objectKey}?expires=${params.expiresSeconds}`;
  }

  async createPresignedGetUrl(params: PresignGetParams): Promise<string> {
    return `http://inmemory/get/${params.bucket}/${params.objectKey}?expires=${params.expiresSeconds}`;
  }

  async removeObject(params: ObjectKeyParams): Promise<void> {
    const storageKey = this.key(params);
    this.objects.delete(storageKey);
    this.removedKeys.push(storageKey);
  }

  async objectExists(params: ObjectKeyParams): Promise<boolean> {
    return this.objects.has(this.key(params));
  }

  async ensureBucket(bucket: string): Promise<void> {
    this.ensuredBuckets.add(bucket);
  }

  markUploaded(
    params: ObjectKeyParams,
    contentType = 'application/octet-stream',
  ): void {
    this.objects.set(this.key(params), {
      bucket: params.bucket,
      objectKey: params.objectKey,
      contentType,
    });
  }
}
