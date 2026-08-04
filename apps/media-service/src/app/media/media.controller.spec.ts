import { Test, TestingModule } from '@nestjs/testing';
import { Roles } from '@nexatech/shared-auth';
import { InMemoryObjectStorage } from './in-memory.object-storage';
import { MediaController } from './media.controller';
import { InMemoryMediaRepository } from './media.repository';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;
  let storage: InMemoryObjectStorage;

  beforeEach(async () => {
    storage = new InMemoryObjectStorage();
    service = new MediaService(new InMemoryMediaRepository(), storage);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: service }],
    }).compile();
    controller = module.get(MediaController);
  });

  it('returns metadata for presigned media', async () => {
    const presign = await controller.presign('user-1', '', {
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 100,
      ownerType: 'product',
      ownerId: 'p1',
      role: 'gallery',
    });
    const metadata = await controller.metadata(presign.mediaId);
    expect(metadata.status).toBe('pending');
  });

  it('lists media by entity after link', async () => {
    const presign = await controller.presign('user-1', Roles.Staff, {
      fileName: 'link.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 100,
      ownerType: 'product',
      ownerId: 'p1',
      role: 'gallery',
    });
    storage.markUploaded({
      bucket: presign.bucket,
      objectKey: presign.objectKey,
    });
    await controller.confirm('user-1', Roles.Staff, presign.mediaId, {});
    await controller.linkMedia('staff-1', Roles.Staff, presign.mediaId, {
      entityType: 'product',
      entityId: 'p1',
      role: 'gallery',
      sortOrder: 0,
      isPrimary: false,
    });

    const items = await controller.byEntity('product', 'p1');
    expect(items).toHaveLength(1);
  });
});
