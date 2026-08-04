import { EventTypes } from '@nexatech/shared-events';
import { Roles, type Role } from '@nexatech/shared-auth';
import { ErrorCodes } from '@nexatech/shared-errors';
import { InMemoryObjectStorage } from './in-memory.object-storage';
import { InMemoryMediaRepository } from './media.repository';
import { auditEvents, MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;
  let repository: InMemoryMediaRepository;
  let storage: InMemoryObjectStorage;

  const userActor = { userId: 'user-1', roles: [] as Role[] };
  const staffActor = { userId: 'staff-1', roles: [Roles.Staff] };
  const managerActor = { userId: 'manager-1', roles: [Roles.Manager] };
  const otherUser = { userId: 'user-2', roles: [] as Role[] };

  beforeEach(() => {
    auditEvents.length = 0;
    repository = new InMemoryMediaRepository();
    storage = new InMemoryObjectStorage();
    service = new MediaService(repository, storage);
  });

  it('presigns upload and confirms after object exists', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        ownerType: 'product',
        ownerId: 'prod-1',
        role: 'gallery',
      },
      userActor,
    );

    expect(presign.mediaId).toBeDefined();
    expect(presign.uploadUrl).toContain('inmemory/put');
    expect(presign.bucket).toBe('product-media');
    expect(presign.contentType).toBe('image/jpeg');

    storage.markUploaded(
      { bucket: presign.bucket, objectKey: presign.objectKey },
      'image/jpeg',
    );

    const confirmed = await service.confirmUpload(
      presign.mediaId,
      { etag: 'abc' },
      userActor,
    );
    expect(confirmed.status).toBe('active');
    expect(
      auditEvents.some((e) => e.eventType === EventTypes.MEDIA_UPLOADED),
    ).toBe(true);
  });

  it('allows confirm when actor is not owner (SC-01 BOLA always-on lab)', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        ownerType: 'product',
        ownerId: 'prod-1',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });

    const confirmed = await service.confirmUpload(
      presign.mediaId,
      {},
      otherUser,
    );
    expect(confirmed.status).toBe('active');
  });

  it('rejects unsupported mime type', async () => {
    await expect(
      service.presignUpload(
        {
          fileName: 'doc.pdf',
          contentType: 'application/pdf' as 'image/jpeg',
          sizeBytes: 1024,
          ownerType: 'product',
          ownerId: 'prod-1',
          role: 'gallery',
        },
        userActor,
      ),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.MEDIA_INVALID_TYPE,
    });
  });

  it('rejects file exceeding max size', async () => {
    await expect(
      service.presignUpload(
        {
          fileName: 'big.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 21 * 1024 * 1024,
          ownerType: 'product',
          ownerId: 'prod-1',
          role: 'gallery',
        },
        userActor,
      ),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.MEDIA_TOO_LARGE,
    });
  });

  it('deletes media and emits MEDIA_DELETED', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        ownerType: 'product',
        ownerId: 'prod-1',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });
    await service.confirmUpload(presign.mediaId, {}, userActor);

    const deleted = await service.deleteMedia(presign.mediaId, userActor);
    expect(deleted.status).toBe('deleted');
    expect(
      auditEvents.some((e) => e.eventType === EventTypes.MEDIA_DELETED),
    ).toBe(true);
    expect(storage.removedKeys.length).toBeGreaterThan(0);
  });

  it('links media and clears previous primary', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        ownerType: 'product',
        ownerId: 'prod-1',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });
    await service.confirmUpload(presign.mediaId, {}, userActor);

    await service.linkMedia(
      presign.mediaId,
      {
        entityType: 'product',
        entityId: 'prod-1',
        role: 'thumbnail',
        isPrimary: true,
        sortOrder: 0,
      },
      staffActor,
    );

    const presign2 = await service.presignUpload(
      {
        fileName: 'photo2.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        ownerType: 'product',
        ownerId: 'prod-1',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign2.bucket,
      objectKey: presign2.objectKey,
    });
    await service.confirmUpload(presign2.mediaId, {}, userActor);

    await service.linkMedia(
      presign2.mediaId,
      {
        entityType: 'product',
        entityId: 'prod-1',
        role: 'thumbnail',
        isPrimary: true,
        sortOrder: 0,
      },
      staffActor,
    );

    const links = await repository.findLinksByEntity('product', 'prod-1');
    const primaries = links.filter(
      (l) => l.role === 'thumbnail' && l.isPrimary,
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.mediaId).toBe(presign2.mediaId);
  });

  it('cleans up pending orphans older than threshold', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'orphan.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 512,
        ownerType: 'misc',
        ownerId: 'misc-1',
        role: 'gallery',
      },
      userActor,
    );

    const media = await repository.findById(presign.mediaId);
    expect(media).toBeTruthy();
    if (media) {
      media.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      repository['media'].set(media.id, media);
    }

    const result = await service.cleanupOrphans(24, managerActor);
    expect(result.removed).toBe(1);
    expect(result.mediaIds).toContain(presign.mediaId);
    expect(await repository.findById(presign.mediaId)).toBeNull();
  });

  it('allows public download for active product media', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'public.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 512,
        ownerType: 'product',
        ownerId: 'prod-public',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });
    await service.confirmUpload(presign.mediaId, {}, userActor);

    const download = await service.getDownloadUrl(presign.mediaId, otherUser);
    expect(download.downloadUrl).toContain('inmemory/get');
  });

  it('allows download for private user media without ownership (SC-01/SC-36 lab)', async () => {
    const presign = await service.presignUpload(
      {
        fileName: 'private.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 512,
        ownerType: 'user',
        ownerId: 'user-1',
        role: 'gallery',
      },
      userActor,
    );
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });
    await service.confirmUpload(presign.mediaId, {}, userActor);

    const download = await service.getDownloadUrl(presign.mediaId, otherUser);
    expect(download.downloadUrl).toContain('inmemory/get');
  });
});
