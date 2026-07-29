export interface PresignPutParams {
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresSeconds: number;
}

export interface PresignGetParams {
  bucket: string;
  objectKey: string;
  expiresSeconds: number;
}

export interface ObjectKeyParams {
  bucket: string;
  objectKey: string;
}

export interface ObjectStorage {
  createPresignedPutUrl(params: PresignPutParams): Promise<string>;
  createPresignedGetUrl(params: PresignGetParams): Promise<string>;
  removeObject(params: ObjectKeyParams): Promise<void>;
  objectExists(params: ObjectKeyParams): Promise<boolean>;
  ensureBucket(bucket: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
