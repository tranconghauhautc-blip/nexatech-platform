import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from './prisma.service';
import type { SupportRepository } from './support.repository';
import type {
  AddMessageInput,
  AssignTicketInput,
  AttachTicketMediaInput,
  CreateTicketInput,
  IdempotencyRecord,
  ListTicketsFilter,
  ListTicketsResult,
  OutboxEventInput,
  OutboxEventRecord,
  SupportTicketAttachmentRecord,
  SupportTicketRecord,
  TransitionTicketInput,
  UpdatePriorityInput,
} from './support.types';

const MAX_ATTACHMENTS_PER_TICKET = 5;

const TICKET_INCLUDE = {
  attachments: true,
  messages: { orderBy: { createdAt: 'asc' as const } },
  history: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SupportTicketInclude;

type PrismaTicketFull = Prisma.SupportTicketGetPayload<{
  include: typeof TICKET_INCLUDE;
}>;

type DbClient = PrismaService | Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

function mapAttachment(
  row: PrismaTicketFull['attachments'][number],
): SupportTicketAttachmentRecord {
  return {
    id: row.id,
    ticketId: row.ticketId,
    messageId: row.messageId ?? undefined,
    mediaId: row.mediaId,
    kind: row.kind,
    deletedAt: row.deletedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapMessage(
  row: PrismaTicketFull['messages'][number],
): SupportTicketRecord['messages'][number] {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId,
    authorType: row.authorType,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function mapHistory(
  row: PrismaTicketFull['history'][number],
): SupportTicketRecord['history'][number] {
  return {
    id: row.id,
    ticketId: row.ticketId,
    fromStatus: row.fromStatus ?? undefined,
    toStatus: row.toStatus,
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapTicket(row: PrismaTicketFull): SupportTicketRecord {
  return {
    id: row.id,
    ticketCode: row.ticketCode,
    customerId: row.customerId,
    category: row.category,
    priority: row.priority,
    subject: row.subject,
    description: row.description,
    status: row.status,
    orderId: row.orderId ?? undefined,
    warrantyClaimId: row.warrantyClaimId ?? undefined,
    returnRequestId: row.returnRequestId ?? undefined,
    assigneeId: row.assigneeId ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attachments: row.attachments.map(mapAttachment),
    messages: row.messages.map(mapMessage),
    history: row.history.map(mapHistory),
  };
}

async function insertOutbox(
  tx: Prisma.TransactionClient,
  events: OutboxEventInput[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await tx.outboxEvent.createMany({
    data: events.map((event) => ({
      id: createId(),
      eventType: event.eventType,
      routingKey: event.routingKey,
      payloadJson: event.payload as Prisma.InputJsonValue,
      traceId: event.traceId,
    })),
  });
}

async function insertAudit(
  tx: Prisma.TransactionClient,
  action: string,
  actorId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      id: createId(),
      action,
      actorId,
      details: details as Prisma.InputJsonValue | undefined,
    },
  });
}

async function loadTicket(
  client: DbClient,
  id: string,
): Promise<PrismaTicketFull | null> {
  return client.supportTicket.findUnique({
    where: { id },
    include: TICKET_INCLUDE,
  });
}

async function loadTicketOrThrow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<PrismaTicketFull> {
  const row = await loadTicket(tx, id);
  if (!row) {
    throw new AppError({
      errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
      message: 'Không tìm thấy yêu cầu hỗ trợ',
    });
  }
  return row;
}

function buildListWhere(
  filter: ListTicketsFilter,
): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = {};
  if (filter.customerId) {
    where.customerId = filter.customerId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.category) {
    where.category = filter.category;
  }
  if (filter.priority) {
    where.priority = filter.priority;
  }
  if (filter.assigneeId) {
    where.assigneeId = filter.assigneeId;
  }
  if (filter.orderId) {
    where.orderId = filter.orderId;
  }
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) {
      where.createdAt.gte = filter.from;
    }
    if (filter.to) {
      where.createdAt.lte = filter.to;
    }
  }
  return where;
}

export class PrismaSupportRepository implements SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(input: CreateTicketInput): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const id = createId();
      const attachmentRows = (input.attachments ?? []).map((m) => ({
        id: createId(),
        mediaId: m.mediaId,
        kind: m.kind,
      }));

      try {
        await tx.supportTicket.create({
          data: {
            id,
            ticketCode: input.ticketCode,
            customerId: input.customerId,
            category: input.category,
            priority: input.priority,
            subject: input.subject,
            description: input.description,
            status: 'OPEN',
            orderId: input.orderId,
            warrantyClaimId: input.warrantyClaimId,
            returnRequestId: input.returnRequestId,
            attachments: { create: attachmentRows },
            history: {
              create: {
                id: createId(),
                toStatus: 'OPEN',
                action: 'create',
                actorId: input.customerId,
                actorType: 'customer',
              },
            },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_CONFLICT,
            message: 'Mã yêu cầu hỗ trợ đã tồn tại',
          });
        }
        throw error;
      }

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadTicketOrThrow(tx, id);
      return mapTicket(row);
    });
  }

  async findTicketById(id: string): Promise<SupportTicketRecord | null> {
    const row = await loadTicket(this.prisma, id);
    return row ? mapTicket(row) : null;
  }

  async transitionTicket(
    input: TransitionTicketInput,
  ): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadTicketOrThrow(tx, input.ticketId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }
      if (current.status !== input.fromStatus) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
          message: 'Trạng thái yêu cầu hỗ trợ không khớp',
          details: { expected: input.fromStatus, actual: current.status },
        });
      }

      const where: Prisma.SupportTicketWhereInput = {
        id: input.ticketId,
        status: input.fromStatus,
      };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.supportTicket.updateMany({
        where,
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.supportTicketHistory.create({
        data: {
          id: createId(),
          ticketId: input.ticketId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          action: input.action,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadTicketOrThrow(tx, input.ticketId);
      return mapTicket(row);
    });
  }

  async assignTicket(input: AssignTicketInput): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadTicketOrThrow(tx, input.ticketId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }

      const where: Prisma.SupportTicketWhereInput = { id: input.ticketId };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.supportTicket.updateMany({
        where,
        data: {
          assigneeId: input.assigneeId,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.supportTicketHistory.create({
        data: {
          id: createId(),
          ticketId: input.ticketId,
          fromStatus: current.status,
          toStatus: current.status,
          action: 'assign',
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.assigneeId,
        },
      });

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadTicketOrThrow(tx, input.ticketId);
      return mapTicket(row);
    });
  }

  async updatePriority(
    input: UpdatePriorityInput,
  ): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadTicketOrThrow(tx, input.ticketId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }

      const where: Prisma.SupportTicketWhereInput = { id: input.ticketId };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.supportTicket.updateMany({
        where,
        data: {
          priority: input.priority,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_CONFLICT,
          message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.supportTicketHistory.create({
        data: {
          id: createId(),
          ticketId: input.ticketId,
          fromStatus: current.status,
          toStatus: current.status,
          action: 'update_priority',
          actorId: input.actorId,
          actorType: input.actorType,
        },
      });

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadTicketOrThrow(tx, input.ticketId);
      return mapTicket(row);
    });
  }

  async addMessage(input: AddMessageInput): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadTicketOrThrow(tx, input.ticketId);
      const activeCount = current.attachments.filter(
        (a) => !a.deletedAt,
      ).length;
      const newCount = input.attachments?.length ?? 0;
      if (activeCount + newCount > MAX_ATTACHMENTS_PER_TICKET) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT,
          message: `Tối đa ${MAX_ATTACHMENTS_PER_TICKET} tệp đính kèm cho mỗi yêu cầu hỗ trợ`,
        });
      }

      const messageId = createId();
      await tx.supportTicketMessage.create({
        data: {
          id: messageId,
          ticketId: input.ticketId,
          authorId: input.authorId,
          authorType: input.authorType,
          content: input.content,
          attachments: {
            create: (input.attachments ?? []).map((m) => ({
              id: createId(),
              ticketId: input.ticketId,
              mediaId: m.mediaId,
              kind: m.kind,
            })),
          },
        },
      });

      const updateData: Prisma.SupportTicketUpdateInput = {
        version: { increment: 1 },
        updatedAt: new Date(),
      };
      if (input.statusTransition) {
        updateData.status = input.statusTransition.toStatus;
      }
      await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: updateData,
      });

      if (input.statusTransition) {
        await tx.supportTicketHistory.create({
          data: {
            id: createId(),
            ticketId: input.ticketId,
            fromStatus: input.statusTransition.fromStatus,
            toStatus: input.statusTransition.toStatus,
            action: input.statusTransition.action,
            actorId: input.authorId,
            actorType: input.authorType === 'STAFF' ? 'staff' : 'customer',
          },
        });
      }

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadTicketOrThrow(tx, input.ticketId);
      return mapTicket(row);
    });
  }

  async attachMedia(
    input: AttachTicketMediaInput,
  ): Promise<SupportTicketRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadTicketOrThrow(tx, input.ticketId);
      const ticket = mapTicket(current);

      if (
        ticket.attachments.some(
          (a) => a.mediaId === input.mediaId && !a.deletedAt && !a.messageId,
        )
      ) {
        return ticket;
      }
      const active = ticket.attachments.filter((a) => !a.deletedAt);
      if (active.length >= MAX_ATTACHMENTS_PER_TICKET) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT,
          message: `Tối đa ${MAX_ATTACHMENTS_PER_TICKET} tệp đính kèm cho mỗi yêu cầu hỗ trợ`,
        });
      }

      await tx.supportTicketAttachment.create({
        data: {
          id: createId(),
          ticketId: input.ticketId,
          mediaId: input.mediaId,
          kind: input.kind,
        },
      });
      await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });
      await insertOutbox(tx, input.outbox);

      const row = await loadTicketOrThrow(tx, input.ticketId);
      return mapTicket(row);
    });
  }

  async listTickets(filter: ListTicketsFilter): Promise<ListTicketsResult> {
    const where = buildListWhere(filter);
    const orderBy: Prisma.SupportTicketOrderByWithRelationInput = {
      createdAt: filter.sort === 'oldest' ? 'asc' : 'desc',
    };
    const skip = (filter.page - 1) * filter.pageSize;

    const [rows, totalItems] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy,
        skip,
        take: filter.pageSize,
        include: TICKET_INCLUDE,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { items: rows.map(mapTicket), totalItems };
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.supportIdempotency.findUnique({
      where: { key },
    });
    if (!row) {
      return null;
    }
    return {
      key: row.key,
      operation: row.operation,
      response: row.responseJson,
      createdAt: row.createdAt,
    };
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    try {
      await this.prisma.supportIdempotency.create({
        data: {
          key,
          operation,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã được sử dụng',
        });
      }
      throw error;
    }
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.createMany({
      data: events.map((event) => ({
        id: createId(),
        eventType: event.eventType,
        routingKey: event.routingKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
        traceId: event.traceId,
      })),
    });
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      routingKey: row.routingKey,
      payload: row.payloadJson as Record<string, unknown>,
      traceId: row.traceId,
      publishedAt: row.publishedAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: createId(),
        action,
        actorId,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
