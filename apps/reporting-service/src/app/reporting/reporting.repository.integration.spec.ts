import { createId } from '@nexatech/shared-platform';
import { PrismaReportingRepository } from './prisma-reporting.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['REPORTING_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('PrismaReportingRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaReportingRepository;
  const createdOrderIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdAuditLogIds: string[] = [];
  const createdProcessedEventIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];
  const createdMetricKeys: Array<{
    metricDate: Date;
    domain: string;
    metricKey: string;
  }> = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaReportingRepository(prisma);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.orderProjection.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.paymentProjection.deleteMany({
        where: { paymentId: { in: createdPaymentIds } },
      });
    }
    if (createdAuditLogIds.length > 0) {
      await prisma.auditLogProjection.deleteMany({
        where: { id: { in: createdAuditLogIds } },
      });
    }
    if (createdProcessedEventIds.length > 0) {
      await prisma.processedEvent.deleteMany({
        where: { eventId: { in: createdProcessedEventIds } },
      });
    }
    if (createdIdempotencyKeys.length > 0) {
      await prisma.reportingIdempotency.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      });
    }
    for (const m of createdMetricKeys) {
      await prisma.dailyMetric.deleteMany({
        where: {
          metricDate: m.metricDate,
          domain: m.domain,
          metricKey: m.metricKey,
        },
      });
    }
    await prisma.$disconnect();
  });

  it('creates and updates an OrderProjection via upsert', async () => {
    const orderId = `it-order-${createId().slice(0, 8)}`;
    createdOrderIds.push(orderId);
    const occurredAt = new Date();

    await repository.upsertOrderProjection({
      orderId,
      orderCode: 'NT-IT-1',
      customerId: 'cust-it-1',
      status: 'CREATED',
      grandTotal: 100000,
      totalQuantity: 1,
      occurredAt,
      lastEventType: 'order.created',
      lastEventId: createId(),
    });

    const listed = await repository.listOrderProjections({
      page: 1,
      pageSize: 20,
    });
    expect(listed.items.some((o) => o.orderId === orderId)).toBe(true);

    await repository.upsertOrderProjection({
      orderId,
      status: 'CONFIRMED',
      occurredAt: new Date(),
      lastEventType: 'order.confirmed',
      lastEventId: createId(),
    });

    const afterUpdate = await repository.listOrderProjections({
      page: 1,
      pageSize: 20,
      customerId: 'cust-it-1',
    });
    const found = afterUpdate.items.find((o) => o.orderId === orderId);
    expect(found?.status).toBe('CONFIRMED');
    expect(found?.orderCode).toBe('NT-IT-1');
  });

  it('atomically increments a DailyMetric under concurrent writers', async () => {
    const metricDate = new Date(Date.UTC(2026, 0, 1));
    const domain = 'PAYMENT';
    const metricKey = `it_revenue_${createId().slice(0, 8)}`;
    createdMetricKeys.push({ metricDate, domain, metricKey });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        repository.incrementDailyMetric(metricDate, domain, metricKey, 1000),
      ),
    );

    const result = await repository.listDailyMetrics({
      domain,
      page: 1,
      pageSize: 20,
    });
    const metric = result.items.find((m) => m.metricKey === metricKey);
    expect(metric?.value).toBe(BigInt(10000));
  });

  it('enforces ProcessedEvent uniqueness for the inbox pattern (idempotency)', async () => {
    const eventId = createId();
    createdProcessedEventIds.push(eventId);

    const first = await repository.tryMarkProcessed(
      eventId,
      'order.created',
      'order.order.created',
    );
    expect(first).toBe(true);

    const second = await repository.tryMarkProcessed(
      eventId,
      'order.created',
      'order.order.created',
    );
    expect(second).toBe(false);

    expect(await repository.isProcessed(eventId)).toBe(true);
  });

  it('deduplicates AuditLogProjection inserts by sourceEventId', async () => {
    const sourceEventId = createId();

    const first = await repository.insertAuditLogProjection({
      sourceEventId,
      action: 'media.confirm',
      actorId: 'staff-it-1',
      resourceType: 'MEDIA',
      resourceId: 'media-it-1',
      serviceName: 'media-service',
      occurredAt: new Date(),
    });
    createdAuditLogIds.push(first.id);

    const second = await repository.insertAuditLogProjection({
      sourceEventId,
      action: 'media.confirm',
      actorId: 'staff-it-1',
      resourceType: 'MEDIA',
      resourceId: 'media-it-1',
      serviceName: 'media-service',
      occurredAt: new Date(),
    });

    expect(second.id).toBe(first.id);

    const listed = await repository.listAuditLogs({
      resourceId: 'media-it-1',
      page: 1,
      pageSize: 20,
    });
    expect(listed.items.filter((a) => a.id === first.id)).toHaveLength(1);
  });

  it('supports idempotency for REST operations and rejects conflicting reuse', async () => {
    const key = `it-idem-${createId()}`;
    createdIdempotencyKeys.push(key);

    await repository.saveIdempotency(key, 'recordAudit', { ok: true });
    const stored = await repository.getIdempotency(key);
    expect(stored?.operation).toBe('recordAudit');

    await expect(
      repository.saveIdempotency(key, 'recordAudit', { ok: true }),
    ).rejects.toMatchObject({ errorCode: 'REPORTING_IDEMPOTENCY_CONFLICT' });
  });

  it('computes a dashboard summary reflecting persisted projections', async () => {
    const paymentId = `it-payment-${createId().slice(0, 8)}`;
    createdPaymentIds.push(paymentId);

    await repository.upsertPaymentProjection({
      paymentId,
      orderId: 'order-it-dashboard',
      status: 'PAID',
      amount: 250000,
      method: 'VNPAY',
      currency: 'VND',
      occurredAt: new Date(),
      lastEventType: 'payment.paid',
    });

    const summary = await repository.getDashboardSummary();
    expect(summary.totalPayments).toBeGreaterThanOrEqual(1);
    expect(summary.paymentsByStatus['PAID']).toBeGreaterThanOrEqual(1);
  });
});
