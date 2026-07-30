import { createId } from '@nexatech/shared-platform';
import { PrismaNotificationRepository } from './prisma-notification.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['NOTIFICATION_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('PrismaNotificationRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaNotificationRepository;
  const createdInAppIds: string[] = [];
  const createdEmailIds: string[] = [];
  const createdProcessedEventIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaNotificationRepository(prisma);
  });

  afterAll(async () => {
    if (createdInAppIds.length > 0) {
      await prisma.inAppNotification.deleteMany({
        where: { id: { in: createdInAppIds } },
      });
    }
    if (createdEmailIds.length > 0) {
      await prisma.emailDelivery.deleteMany({
        where: { id: { in: createdEmailIds } },
      });
    }
    if (createdProcessedEventIds.length > 0) {
      await prisma.processedEvent.deleteMany({
        where: { eventId: { in: createdProcessedEventIds } },
      });
    }
    if (createdIdempotencyKeys.length > 0) {
      await prisma.notificationIdempotency.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates, lists, marks read and soft-deletes in-app notifications', async () => {
    const userId = `it-user-${createId().slice(0, 8)}`;

    const created = await repository.createInApp({
      userId,
      category: 'ORDER',
      templateKey: 'order.created',
      title: 'Đơn hàng NT-IT-1 đã được tạo',
      body: 'Đơn hàng NT-IT-1 của bạn đã được tạo thành công.',
    });
    createdInAppIds.push(created.id);
    expect(created.readAt).toBeUndefined();

    const unreadBefore = await repository.countUnread(userId);
    expect(unreadBefore).toBe(1);

    const listed = await repository.listInApp(userId, {
      page: 1,
      pageSize: 20,
    });
    expect(listed.totalItems).toBe(1);
    expect(listed.items[0]?.id).toBe(created.id);

    const read = await repository.markRead(created.id, userId);
    expect(read.readAt).toBeInstanceOf(Date);

    const unreadAfter = await repository.countUnread(userId);
    expect(unreadAfter).toBe(0);

    await repository.softDelete(created.id, userId);
    const afterDelete = await repository.listInApp(userId, {
      page: 1,
      pageSize: 20,
    });
    expect(afterDelete.totalItems).toBe(0);
  });

  it('creates and updates email deliveries', async () => {
    const created = await repository.createEmailDelivery({
      toEmail: 'it-integration@example.com',
      templateKey: 'payment.paid',
      subject: 'Thanh toán thành công',
      bodyText: 'Nội dung email kiểm thử tích hợp',
      status: 'PENDING',
    });
    createdEmailIds.push(created.id);
    expect(created.status).toBe('PENDING');
    expect(created.attempts).toBe(0);

    const updated = await repository.updateEmailDelivery({
      id: created.id,
      status: 'SENT',
      attempts: 1,
      sentAt: new Date(),
    });
    expect(updated.status).toBe('SENT');
    expect(updated.attempts).toBe(1);

    const list = await repository.listEmailByStatus({
      status: 'SENT',
      page: 1,
      pageSize: 20,
    });
    expect(list.items.some((e) => e.id === created.id)).toBe(true);
  });

  it('enforces ProcessedEvent uniqueness for the inbox pattern', async () => {
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

  it('supports idempotency for REST operations', async () => {
    const key = `it-idem-${createId()}`;
    createdIdempotencyKeys.push(key);

    await repository.saveIdempotency(key, 'requestNotification', { ok: true });
    const stored = await repository.getIdempotency(key);
    expect(stored?.operation).toBe('requestNotification');

    await expect(
      repository.saveIdempotency(key, 'requestNotification', { ok: true }),
    ).rejects.toMatchObject({ errorCode: 'NOTIFICATION_IDEMPOTENCY_CONFLICT' });
  });
});
