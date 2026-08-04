import {
  assertIntegrationTestDatabaseReady,
  createId,
  shouldRunIntegrationDatabaseSuite,
} from '@nexatech/shared-platform';
import { PrismaWarrantyRepository } from './prisma-warranty.repository';
import { PrismaService } from './prisma.service';
import { generateClaimCode, generateReturnCode } from './warranty-code';

/**
 * Destructive integration suite. Requires WARRANTY_TEST_DATABASE_URL pointing at
 * nexatech_warranty_test only — never falls back to WARRANTY_DATABASE_URL.
 */
const WARRANTY_TEST_DB = {
  testUrlEnv: 'WARRANTY_TEST_DATABASE_URL',
  requiredDatabaseName: 'nexatech_warranty_test',
  runtimeUrlEnv: 'WARRANTY_DATABASE_URL',
} as const;

const describeIfDb = shouldRunIntegrationDatabaseSuite(
  WARRANTY_TEST_DB.testUrlEnv,
)
  ? describe
  : describe.skip;

describeIfDb('PrismaWarrantyRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaWarrantyRepository;
  const createdClaimIds: string[] = [];
  const createdReturnIds: string[] = [];

  beforeAll(async () => {
    assertIntegrationTestDatabaseReady(WARRANTY_TEST_DB);
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaWarrantyRepository(prisma);
  });

  afterAll(async () => {
    assertIntegrationTestDatabaseReady(WARRANTY_TEST_DB);
    if (createdClaimIds.length > 0) {
      await prisma.warrantyClaimHistory.deleteMany({
        where: { claimId: { in: createdClaimIds } },
      });
      await prisma.warrantyClaimMedia.deleteMany({
        where: { claimId: { in: createdClaimIds } },
      });
      await prisma.warrantyClaim.deleteMany({
        where: { id: { in: createdClaimIds } },
      });
    }
    if (createdReturnIds.length > 0) {
      await prisma.returnRequestHistory.deleteMany({
        where: { returnId: { in: createdReturnIds } },
      });
      await prisma.returnRequestMedia.deleteMany({
        where: { returnId: { in: createdReturnIds } },
      });
      await prisma.returnRequest.deleteMany({
        where: { id: { in: createdReturnIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates a warranty claim, attaches media and transitions through lifecycle', async () => {
    const suffix = createId().slice(0, 8);
    const customerId = `it-cust-${suffix}`;
    const orderItemId = `it-oi-${suffix}`;

    const claim = await repository.createClaim({
      claimCode: generateClaimCode(),
      orderId: `it-ord-${suffix}`,
      orderCode: `NT-IT-${suffix}`,
      orderItemId,
      customerId,
      productId: `it-prod-${suffix}`,
      skuId: `it-sku-${suffix}`,
      skuCode: `IT-SKU-${suffix}`,
      productName: 'Điện thoại kiểm thử',
      issueType: 'DEFECT',
      description:
        'Sản phẩm bị lỗi màn hình trong quá trình kiểm thử tích hợp.',
      activeKey: `${customerId}:${orderItemId}`,
      media: [{ mediaId: `it-media-${suffix}`, kind: 'IMAGE' }],
      outbox: [
        {
          eventType: 'warranty.claim_created',
          routingKey: 'warranty.claim.created',
          payload: { claimCode: 'test' },
          traceId: createId(),
        },
      ],
      audit: { action: 'warranty.claim.create', actorId: customerId },
    });
    createdClaimIds.push(claim.id);

    expect(claim.status).toBe('SUBMITTED');
    expect(claim.media).toHaveLength(1);
    expect(claim.version).toBe(0);

    const duplicate = await repository.findActiveClaimByCustomerOrderItem(
      customerId,
      orderItemId,
    );
    expect(duplicate?.id).toBe(claim.id);

    await expect(
      repository.createClaim({
        claimCode: generateClaimCode(),
        orderId: `it-ord-${suffix}`,
        orderCode: `NT-IT-${suffix}`,
        orderItemId,
        customerId,
        productId: `it-prod-${suffix}`,
        productName: 'Điện thoại kiểm thử',
        issueType: 'DEFECT',
        description: 'Yêu cầu bảo hành trùng lặp cho cùng sản phẩm.',
        activeKey: `${customerId}:${orderItemId}`,
        outbox: [],
      }),
    ).rejects.toMatchObject({ errorCode: 'WARRANTY_ALREADY_EXISTS' });

    const reviewing = await repository.transitionClaim({
      claimId: claim.id,
      fromStatus: 'SUBMITTED',
      toStatus: 'UNDER_REVIEW',
      action: 'start_review',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(reviewing.status).toBe('UNDER_REVIEW');
    expect(reviewing.version).toBe(1);
    expect(reviewing.history).toHaveLength(2);

    await expect(
      repository.transitionClaim({
        claimId: claim.id,
        expectedVersion: 0,
        fromStatus: 'UNDER_REVIEW',
        toStatus: 'APPROVED',
        action: 'approve',
        actorId: 'it-staff',
        actorType: 'staff',
        outbox: [],
      }),
    ).rejects.toMatchObject({ errorCode: 'WARRANTY_CONFLICT' });

    const approved = await repository.transitionClaim({
      claimId: claim.id,
      expectedVersion: 1,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'APPROVED',
      action: 'approve',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(approved.status).toBe('APPROVED');

    const fetched = await repository.findClaimById(claim.id);
    expect(fetched?.status).toBe('APPROVED');
  });

  it('creates a return request and syncs order status through history', async () => {
    const suffix = createId().slice(0, 8);
    const customerId = `it-cust-r-${suffix}`;
    const orderItemId = `it-oi-r-${suffix}`;

    const ret = await repository.createReturn({
      returnCode: generateReturnCode(),
      orderId: `it-ord-r-${suffix}`,
      orderCode: `NT-IT-R-${suffix}`,
      orderItemId,
      customerId,
      productId: `it-prod-r-${suffix}`,
      productName: 'Laptop kiểm thử',
      reason: 'DEFECTIVE',
      description: 'Sản phẩm lỗi bàn phím cần đổi trả trong kiểm thử tích hợp.',
      quantity: 1,
      desiredResolution: 'REFUND',
      activeKey: `${customerId}:${orderItemId}`,
      outbox: [],
    });
    createdReturnIds.push(ret.id);
    expect(ret.status).toBe('REQUESTED');

    const underReview = await repository.transitionReturn({
      returnId: ret.id,
      fromStatus: 'REQUESTED',
      toStatus: 'UNDER_REVIEW',
      action: 'start_review',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(underReview.status).toBe('UNDER_REVIEW');

    const approved = await repository.transitionReturn({
      returnId: ret.id,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'APPROVED',
      action: 'approve',
      actorId: 'it-staff',
      actorType: 'staff',
      orderSync: { status: 'RETURN_REQUESTED', syncedAt: new Date() },
      outbox: [],
    });
    expect(approved.orderSyncedStatus).toBe('RETURN_REQUESTED');
    expect(approved.orderSyncedAt).toBeTruthy();

    // APPROVED is not a terminal status, so the active key stays occupied.
    const active = await repository.findActiveReturnByCustomerOrderItem(
      customerId,
      orderItemId,
    );
    expect(active?.id).toBe(ret.id);

    const fetched = await repository.findReturnById(ret.id);
    expect(fetched?.history).toHaveLength(3);
  });

  it('supports idempotency and outbox dispatch tracking', async () => {
    const key = `it-idem-${createId()}`;
    await repository.saveIdempotency(key, 'createWarrantyClaim', {
      ok: true,
    });
    const stored = await repository.getIdempotency(key);
    expect(stored?.operation).toBe('createWarrantyClaim');

    await expect(
      repository.saveIdempotency(key, 'createWarrantyClaim', { ok: true }),
    ).rejects.toMatchObject({ errorCode: 'WARRANTY_IDEMPOTENCY_CONFLICT' });

    const traceId = createId();
    await repository.addOutbox([
      {
        eventType: 'warranty.claim_created',
        routingKey: 'warranty.claim.created',
        payload: { test: true },
        traceId,
      },
    ]);
    const unpublished = await repository.listUnpublishedOutbox(50);
    const match = unpublished.find((e) => e.traceId === traceId);
    expect(match).toBeTruthy();
    if (match) {
      await repository.markOutboxPublished([match.id]);
    }
    const afterPublish = await repository.listUnpublishedOutbox(50);
    expect(afterPublish.find((e) => e.traceId === traceId)).toBeUndefined();
  });
});
