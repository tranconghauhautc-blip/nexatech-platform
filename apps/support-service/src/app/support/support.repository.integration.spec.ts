import { createId } from '@nexatech/shared-platform';
import { PrismaSupportRepository } from './prisma-support.repository';
import { PrismaService } from './prisma.service';
import { generateTicketCode } from './support-code';

const describeIfDb = process.env['SUPPORT_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('PrismaSupportRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaSupportRepository;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaSupportRepository(prisma);
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.supportTicketHistory.deleteMany({
        where: { ticketId: { in: createdTicketIds } },
      });
      await prisma.supportTicketAttachment.deleteMany({
        where: { ticketId: { in: createdTicketIds } },
      });
      await prisma.supportTicketMessage.deleteMany({
        where: { ticketId: { in: createdTicketIds } },
      });
      await prisma.supportTicket.deleteMany({
        where: { id: { in: createdTicketIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates a ticket, adds a message and transitions through lifecycle', async () => {
    const suffix = createId().slice(0, 8);
    const customerId = `it-cust-${suffix}`;

    const ticket = await repository.createTicket({
      ticketCode: generateTicketCode(),
      customerId,
      category: 'PRODUCT',
      priority: 'NORMAL',
      subject: 'Sản phẩm kiểm thử tích hợp gặp lỗi',
      description:
        'Sản phẩm kiểm thử tích hợp không hoạt động đúng trong quá trình test.',
      attachments: [{ mediaId: `it-media-${suffix}`, kind: 'IMAGE' }],
      outbox: [
        {
          eventType: 'support.ticket_created',
          routingKey: 'support.ticket.created',
          payload: { test: true },
          traceId: createId(),
        },
      ],
      audit: { action: 'support.ticket.create', actorId: customerId },
    });
    createdTicketIds.push(ticket.id);

    expect(ticket.status).toBe('OPEN');
    expect(ticket.attachments).toHaveLength(1);
    expect(ticket.version).toBe(0);

    const inProgress = await repository.transitionTicket({
      ticketId: ticket.id,
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
      action: 'start',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(inProgress.status).toBe('IN_PROGRESS');
    expect(inProgress.version).toBe(1);
    expect(inProgress.history).toHaveLength(2);

    await expect(
      repository.transitionTicket({
        ticketId: ticket.id,
        expectedVersion: 0,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'RESOLVED',
        action: 'resolve',
        actorId: 'it-staff',
        actorType: 'staff',
        outbox: [],
      }),
    ).rejects.toMatchObject({ errorCode: 'SUPPORT_CONFLICT' });

    const withMessage = await repository.addMessage({
      ticketId: ticket.id,
      authorId: 'it-staff',
      authorType: 'STAFF',
      content: 'Chúng tôi đang xử lý yêu cầu của bạn.',
      outbox: [],
    });
    expect(withMessage.messages).toHaveLength(1);
    expect(withMessage.version).toBe(2);

    const assigned = await repository.assignTicket({
      ticketId: ticket.id,
      assigneeId: 'it-staff-2',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(assigned.assigneeId).toBe('it-staff-2');

    const resolved = await repository.transitionTicket({
      ticketId: ticket.id,
      expectedVersion: assigned.version,
      fromStatus: 'IN_PROGRESS',
      toStatus: 'RESOLVED',
      action: 'resolve',
      actorId: 'it-staff',
      actorType: 'staff',
      outbox: [],
    });
    expect(resolved.status).toBe('RESOLVED');

    const fetched = await repository.findTicketById(ticket.id);
    expect(fetched?.status).toBe('RESOLVED');
  });

  it('supports idempotency and outbox dispatch tracking', async () => {
    const key = `it-idem-${createId()}`;
    await repository.saveIdempotency(key, 'createSupportTicket', {
      ok: true,
    });
    const stored = await repository.getIdempotency(key);
    expect(stored?.operation).toBe('createSupportTicket');

    await expect(
      repository.saveIdempotency(key, 'createSupportTicket', { ok: true }),
    ).rejects.toMatchObject({ errorCode: 'SUPPORT_IDEMPOTENCY_CONFLICT' });

    const traceId = createId();
    await repository.addOutbox([
      {
        eventType: 'support.ticket_created',
        routingKey: 'support.ticket.created',
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
