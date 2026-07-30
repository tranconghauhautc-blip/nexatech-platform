import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
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
  SupportTicketRecord,
  TransitionTicketInput,
  UpdatePriorityInput,
} from './support.types';

export const SUPPORT_REPOSITORY = Symbol('SUPPORT_REPOSITORY');

const MAX_ATTACHMENTS_PER_TICKET = 5;

export interface SupportRepository {
  createTicket(input: CreateTicketInput): Promise<SupportTicketRecord>;
  findTicketById(id: string): Promise<SupportTicketRecord | null>;
  transitionTicket(input: TransitionTicketInput): Promise<SupportTicketRecord>;
  assignTicket(input: AssignTicketInput): Promise<SupportTicketRecord>;
  updatePriority(input: UpdatePriorityInput): Promise<SupportTicketRecord>;
  addMessage(input: AddMessageInput): Promise<SupportTicketRecord>;
  attachMedia(input: AttachTicketMediaInput): Promise<SupportTicketRecord>;
  listTickets(filter: ListTicketsFilter): Promise<ListTicketsResult>;

  getIdempotency(key: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void>;
  addOutbox(events: OutboxEventInput[]): Promise<void>;
  listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]>;
  markOutboxPublished(ids: string[]): Promise<void>;
  writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

function cloneTicket(t: SupportTicketRecord): SupportTicketRecord {
  return {
    ...t,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    attachments: t.attachments.map((a) => ({
      ...a,
      deletedAt: a.deletedAt ? new Date(a.deletedAt) : undefined,
      createdAt: new Date(a.createdAt),
    })),
    messages: t.messages.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    })),
    history: t.history.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })),
  };
}

export class InMemorySupportRepository implements SupportRepository {
  private tickets = new Map<string, SupportTicketRecord>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private outbox: OutboxEventRecord[] = [];
  private audits: Array<{
    id: string;
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  clear(): void {
    this.tickets.clear();
    this.idempotency.clear();
    this.outbox = [];
    this.audits = [];
  }

  async createTicket(input: CreateTicketInput): Promise<SupportTicketRecord> {
    const now = new Date();
    const id = createId();
    const attachments = (input.attachments ?? []).map((m) => ({
      id: createId(),
      ticketId: id,
      mediaId: m.mediaId,
      kind: m.kind,
      createdAt: now,
    }));
    const ticket: SupportTicketRecord = {
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
      version: 0,
      createdAt: now,
      updatedAt: now,
      attachments,
      messages: [],
      history: [
        {
          id: createId(),
          ticketId: id,
          toStatus: 'OPEN',
          action: 'create',
          actorId: input.customerId,
          actorType: 'customer',
          createdAt: now,
        },
      ],
    };
    this.tickets.set(id, ticket);
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneTicket(ticket);
  }

  async findTicketById(id: string): Promise<SupportTicketRecord | null> {
    const t = this.tickets.get(id);
    return t ? cloneTicket(t) : null;
  }

  async transitionTicket(
    input: TransitionTicketInput,
  ): Promise<SupportTicketRecord> {
    const ticket = this.tickets.get(input.ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      ticket.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_CONFLICT,
        message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
      });
    }
    if (ticket.status !== input.fromStatus) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
        message: 'Trạng thái yêu cầu hỗ trợ không khớp',
        details: { expected: input.fromStatus, actual: ticket.status },
      });
    }
    const fromStatus = ticket.status;
    ticket.status = input.toStatus;
    ticket.version += 1;
    ticket.updatedAt = new Date();
    ticket.history.push({
      id: createId(),
      ticketId: ticket.id,
      fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: new Date(),
    });
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneTicket(ticket);
  }

  async assignTicket(input: AssignTicketInput): Promise<SupportTicketRecord> {
    const ticket = this.tickets.get(input.ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      ticket.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_CONFLICT,
        message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
      });
    }
    ticket.assigneeId = input.assigneeId;
    ticket.version += 1;
    ticket.updatedAt = new Date();
    ticket.history.push({
      id: createId(),
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      action: 'assign',
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.assigneeId,
      createdAt: new Date(),
    });
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneTicket(ticket);
  }

  async updatePriority(
    input: UpdatePriorityInput,
  ): Promise<SupportTicketRecord> {
    const ticket = this.tickets.get(input.ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      ticket.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_CONFLICT,
        message: 'Yêu cầu hỗ trợ đã được cập nhật bởi thao tác khác',
      });
    }
    ticket.priority = input.priority;
    ticket.version += 1;
    ticket.updatedAt = new Date();
    ticket.history.push({
      id: createId(),
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      action: 'update_priority',
      actorId: input.actorId,
      actorType: input.actorType,
      createdAt: new Date(),
    });
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneTicket(ticket);
  }

  async addMessage(input: AddMessageInput): Promise<SupportTicketRecord> {
    const ticket = this.tickets.get(input.ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    const activeCount = ticket.attachments.filter((a) => !a.deletedAt).length;
    const newCount = input.attachments?.length ?? 0;
    if (activeCount + newCount > MAX_ATTACHMENTS_PER_TICKET) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT,
        message: `Tối đa ${MAX_ATTACHMENTS_PER_TICKET} tệp đính kèm cho mỗi yêu cầu hỗ trợ`,
      });
    }
    const now = new Date();
    const messageId = createId();
    const message = {
      id: messageId,
      ticketId: ticket.id,
      authorId: input.authorId,
      authorType: input.authorType,
      content: input.content,
      createdAt: now,
    };
    ticket.messages.push(message);
    for (const media of input.attachments ?? []) {
      ticket.attachments.push({
        id: createId(),
        ticketId: ticket.id,
        messageId,
        mediaId: media.mediaId,
        kind: media.kind,
        createdAt: now,
      });
    }
    if (input.statusTransition) {
      ticket.status = input.statusTransition.toStatus;
      ticket.history.push({
        id: createId(),
        ticketId: ticket.id,
        fromStatus: input.statusTransition.fromStatus,
        toStatus: input.statusTransition.toStatus,
        action: input.statusTransition.action,
        actorId: input.authorId,
        actorType: input.authorType === 'STAFF' ? 'staff' : 'customer',
        createdAt: now,
      });
    }
    ticket.version += 1;
    ticket.updatedAt = now;
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneTicket(ticket);
  }

  async attachMedia(
    input: AttachTicketMediaInput,
  ): Promise<SupportTicketRecord> {
    const ticket = this.tickets.get(input.ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    if (
      ticket.attachments.some(
        (a) => a.mediaId === input.mediaId && !a.deletedAt && !a.messageId,
      )
    ) {
      return cloneTicket(ticket);
    }
    const active = ticket.attachments.filter((a) => !a.deletedAt);
    if (active.length >= MAX_ATTACHMENTS_PER_TICKET) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT,
        message: `Tối đa ${MAX_ATTACHMENTS_PER_TICKET} tệp đính kèm cho mỗi yêu cầu hỗ trợ`,
      });
    }
    ticket.attachments.push({
      id: createId(),
      ticketId: ticket.id,
      mediaId: input.mediaId,
      kind: input.kind,
      createdAt: new Date(),
    });
    ticket.version += 1;
    ticket.updatedAt = new Date();
    await this.addOutbox(input.outbox);
    return cloneTicket(ticket);
  }

  async listTickets(filter: ListTicketsFilter): Promise<ListTicketsResult> {
    let items = [...this.tickets.values()];
    if (filter.customerId) {
      items = items.filter((t) => t.customerId === filter.customerId);
    }
    if (filter.status) {
      items = items.filter((t) => t.status === filter.status);
    }
    if (filter.category) {
      items = items.filter((t) => t.category === filter.category);
    }
    if (filter.priority) {
      items = items.filter((t) => t.priority === filter.priority);
    }
    if (filter.assigneeId) {
      items = items.filter((t) => t.assigneeId === filter.assigneeId);
    }
    if (filter.orderId) {
      items = items.filter((t) => t.orderId === filter.orderId);
    }
    if (filter.from) {
      const from = filter.from;
      items = items.filter((t) => t.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((t) => t.createdAt <= to);
    }
    items.sort((a, b) =>
      filter.sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map(cloneTicket),
      totalItems,
    };
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const r = this.idempotency.get(key);
    return r ? { ...r } : null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    if (this.idempotency.has(key)) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_IDEMPOTENCY_CONFLICT,
        message: 'Idempotency key đã được sử dụng',
      });
    }
    this.idempotency.set(key, {
      key,
      operation,
      response,
      createdAt: new Date(),
    });
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    for (const event of events) {
      this.outbox.push({
        id: createId(),
        ...event,
        createdAt: new Date(),
      });
    }
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    return this.outbox
      .filter((e) => !e.publishedAt)
      .slice(0, limit)
      .map((e) => ({ ...e, payload: { ...e.payload } }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    const set = new Set(ids);
    for (const event of this.outbox) {
      if (set.has(event.id)) {
        event.publishedAt = new Date();
      }
    }
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    this.audits.push({
      id: createId(),
      action,
      actorId,
      details,
      createdAt: new Date(),
    });
  }
}
