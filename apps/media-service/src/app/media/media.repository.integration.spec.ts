import { createId } from '@nexatech/shared-platform';
import { PrismaMediaRepository } from './prisma-media.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['MEDIA_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('PrismaMediaRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaMediaRepository;
  const createdMediaIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaMediaRepository(prisma);
  });

  afterAll(async () => {
    if (createdMediaIds.length > 0) {
      await prisma.mediaLink.deleteMany({
        where: { mediaId: { in: createdMediaIds } },
      });
      await prisma.mediaObject.deleteMany({
        where: { id: { in: createdMediaIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates pending media, activates and links to entity', async () => {
    const suffix = createId().slice(0, 8);
    const pending = await repository.createPending({
      bucket: 'product-media',
      objectKey: `product/p1/${suffix}-test.jpg`,
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      ownerType: 'product',
      ownerId: `prod-${suffix}`,
      uploadedBy: 'integration-user',
    });
    createdMediaIds.push(pending.id);
    expect(pending.status).toBe('pending');

    const active = await repository.markActive(pending.id, 'etag-1');
    expect(active.status).toBe('active');

    const link = await repository.createLink({
      mediaId: pending.id,
      entityType: 'product',
      entityId: `prod-${suffix}`,
      role: 'gallery',
      isPrimary: true,
    });
    expect(link.isPrimary).toBe(true);

    const links = await repository.findLinksByEntity(
      'product',
      `prod-${suffix}`,
    );
    expect(links.some((item) => item.id === link.id)).toBe(true);
  });
});
