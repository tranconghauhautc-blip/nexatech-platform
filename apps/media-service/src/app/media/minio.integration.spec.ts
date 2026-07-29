import { createId } from '@nexatech/shared-platform';
import { MinioObjectStorage } from './minio.object-storage';

const describeIfMinio =
  process.env['MINIO_ENDPOINT'] && process.env['MINIO_ACCESS_KEY']
    ? describe
    : describe.skip;

describeIfMinio('MinioObjectStorage integration', () => {
  const bucket = `it-media-${createId().slice(0, 8)}`;
  let storage: MinioObjectStorage;

  beforeAll(async () => {
    storage = new MinioObjectStorage();
    await storage.ensureBucket(bucket);
  });

  afterAll(async () => {
    const objectKey = `integration/${createId()}.txt`;
    try {
      await storage.removeObject({ bucket, objectKey });
    } catch {
      // bucket/object may already be removed
    }
  });

  it('generates presigned put/get URLs and tracks object existence', async () => {
    const objectKey = `integration/${createId()}.txt`;
    const putUrl = await storage.createPresignedPutUrl({
      bucket,
      objectKey,
      contentType: 'text/plain',
      expiresSeconds: 300,
    });
    expect(putUrl).toContain(bucket);

    const existsBefore = await storage.objectExists({ bucket, objectKey });
    expect(existsBefore).toBe(false);

    const getUrl = await storage.createPresignedGetUrl({
      bucket,
      objectKey,
      expiresSeconds: 300,
    });
    expect(getUrl).toContain(bucket);

    await storage.removeObject({ bucket, objectKey });
    const existsAfter = await storage.objectExists({ bucket, objectKey });
    expect(existsAfter).toBe(false);
  });
});
