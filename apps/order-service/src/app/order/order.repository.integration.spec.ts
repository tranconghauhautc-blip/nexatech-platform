import { createId } from '@nexatech/shared-platform';
import { PrismaOrderRepository } from './prisma-order.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['ORDER_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('order repository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaOrderRepository;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.orderPackageItem.deleteMany();
    await prisma.orderPackage.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderAddressSnapshot.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.orderIdempotency.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  it('persists an order with items, address, packages, history and outbox in one transaction', async () => {
    const orderId = createId();
    const skuId = createId();
    const productId = createId();

    const order = await repository.createOrderWithRelations({
      id: orderId,
      orderCode: `NT-20260730-INT${String(Date.now()).slice(-3)}`,
      customerId: 'int-customer-1',
      status: 'CONFIRMED',
      cartId: 'cart-int-1',
      reservationId: 'res-int-1',
      deliveryMethod: 'STANDARD',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      currency: 'VND',
      merchandiseSubtotal: 10_000_000,
      shippingFee: 30_000,
      discountTotal: 0,
      grandTotal: 10_030_000,
      totalQuantity: 1,
      items: [
        {
          skuId,
          skuCode: 'INT-SKU-1',
          skuName: 'SKU tích hợp',
          productId,
          productName: 'Sản phẩm tích hợp',
          variantAttributes: { color: 'Đen' },
          unitPrice: 10_000_000,
          quantity: 1,
          lineSubtotal: 10_000_000,
          currency: 'VND',
        },
      ],
      address: {
        recipientName: 'Người nhận',
        recipientPhone: '0900000000',
        line1: '1 Đường Test',
        city: 'Hồ Chí Minh',
        country: 'VN',
        fullText: '1 Đường Test, Hồ Chí Minh',
      },
      packages: [
        {
          packageCode: 'NT-INT-P01',
          status: 'ALLOCATED',
          sourceLocationType: 'warehouse',
          sourceLocationId: 'WH-MAIN',
          items: [{ skuCode: 'INT-SKU-1', quantity: 1 }],
        },
      ],
      actorId: 'int-customer-1',
      actorType: 'customer',
      outboxEvents: [
        {
          eventType: 'order.created',
          routingKey: 'order.order.created',
          payload: { orderId },
          traceId: createId(),
        },
      ],
    });

    expect(order.items).toHaveLength(1);
    expect(order.address?.city).toBe('Hồ Chí Minh');
    expect(order.packages).toHaveLength(1);
    expect(order.packages[0]?.items).toHaveLength(1);
    expect(order.version).toBe(0);

    const found = await repository.findById(orderId);
    expect(found?.orderCode).toBe(order.orderCode);

    const history = await repository.getStatusHistory(orderId);
    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe('CONFIRMED');

    const unpublished = await repository.listUnpublishedOutbox(10);
    expect(unpublished.length).toBeGreaterThanOrEqual(1);
    await repository.markOutboxPublished(unpublished.map((e) => e.id));
    const stillUnpublished = await repository.listUnpublishedOutbox(10);
    expect(stillUnpublished).toHaveLength(0);
  });

  it('applies optimistic locking on updateStatus', async () => {
    const orderId = createId();
    const order = await repository.createOrderWithRelations({
      id: orderId,
      orderCode: `NT-20260730-OPT${String(Date.now()).slice(-3)}`,
      customerId: 'int-customer-2',
      status: 'PENDING',
      cartId: 'cart-int-2',
      deliveryMethod: 'STANDARD',
      paymentMethod: 'MOCK',
      paymentStatus: 'PENDING',
      currency: 'VND',
      merchandiseSubtotal: 1_000_000,
      shippingFee: 30_000,
      discountTotal: 0,
      grandTotal: 1_030_000,
      totalQuantity: 1,
      items: [],
      packages: [],
      actorId: 'int-customer-2',
      actorType: 'customer',
      outboxEvents: [],
    });

    const updated = await repository.updateStatus({
      orderId: order.id,
      expectedVersion: order.version,
      toStatus: 'AWAITING_PAYMENT',
      actorId: 'int-customer-2',
      actorType: 'customer',
    });
    expect(updated.version).toBe(order.version + 1);

    await expect(
      repository.updateStatus({
        orderId: order.id,
        expectedVersion: order.version,
        toStatus: 'CONFIRMED',
        actorId: 'int-customer-2',
        actorType: 'customer',
      }),
    ).rejects.toMatchObject({ errorCode: 'ORDER_CONFLICT' });
  });

  it('stores and retrieves idempotency records', async () => {
    const key = `int-idem-${createId()}`;
    expect(await repository.getIdempotency(key)).toBeNull();
    await repository.saveIdempotency(key, 'order.create', { ok: true });
    const record = await repository.getIdempotency(key);
    expect(record?.operation).toBe('order.create');
  });
});
