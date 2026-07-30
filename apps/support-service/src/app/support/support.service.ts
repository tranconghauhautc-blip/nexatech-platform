import { createId } from '@nexatech/shared-platform';
import {
  addSupportTicketMessageRequestSchema,
  assignSupportTicketRequestSchema,
  attachSupportTicketMediaRequestSchema,
  cancelSupportTicketRequestSchema,
  createPaginatedResponse,
  createSupportTicketRequestSchema,
  listAdminSupportTicketsQuerySchema,
  listSupportTicketsQuerySchema,
  SUPPORT_LIMITS,
  transitionSupportTicketRequestSchema,
  updateSupportTicketPriorityRequestSchema,
  type AdminSupportTicketDetailDto,
  type SupportMediaKind,
  type SupportMessageAuthorType,
  type SupportTicketAttachmentDto,
  type SupportTicketDetailDto,
  type SupportTicketDto,
  type SupportTicketHistoryDto,
  type SupportTicketMessageDto,
  type SupportTicketStatus,
  type SupportTicketTransitionAction,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  EventTypes,
  createEventEnvelope,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import type { SupportEventPublisher } from './event-publisher';
import type { MediaClient } from './media.client';
import type { OrderClient } from './order.client';
import { generateTicketCode } from './support-code';
import type { SupportRepository } from './support.repository';
import {
  isTicketTerminal,
  resolveCustomerMessageTransition,
  resolveTicketTransition,
} from './ticket-state-machine';
import type {
  Actor,
  OutboxEventInput,
  SupportTicketRecord,
} from './support.types';

const STAFF_ROLES = new Set(['Staff', 'Manager', 'Admin', 'SuperAdmin']);

export function parseActor(userId?: string, rolesHeader?: string): Actor {
  const roles = (rolesHeader ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return { userId: (userId ?? '').trim(), roles };
}

export function isStaff(actor: Actor): boolean {
  return actor.roles.some((r) => STAFF_ROLES.has(r));
}

function requireAuth(actor: Actor): void {
  if (!actor.userId) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Yêu cầu đăng nhập',
    });
  }
}

function requireStaff(actor: Actor): void {
  requireAuth(actor);
  if (!isStaff(actor)) {
    throw new AppError({
      errorCode: ErrorCodes.FORBIDDEN,
      message: 'Không đủ quyền',
    });
  }
}

/** Strip angle brackets / control chars for render-safe display. */
function sanitizeText(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (ch === '<' || ch === '>') {
      continue;
    }
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    out += ch;
  }
  return out.trim();
}

function kindFromMime(mimeType: string): SupportMediaKind {
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }
  throw new AppError({
    errorCode: ErrorCodes.SUPPORT_MEDIA_INVALID,
    message: 'Tệp đính kèm chỉ chấp nhận định dạng ảnh',
    details: { mimeType },
  });
}

function buildOutbox(
  eventType: EventType,
  payload: Record<string, unknown>,
  traceId: string,
): OutboxEventInput {
  return {
    eventType,
    routingKey: routingKeyFor(eventType),
    payload,
    traceId,
  };
}

const TICKET_EVENT_BY_ACTION: Record<SupportTicketTransitionAction, EventType> =
  {
    start: EventTypes.SUPPORT_TICKET_UPDATED,
    wait_customer: EventTypes.SUPPORT_TICKET_UPDATED,
    resolve: EventTypes.SUPPORT_TICKET_RESOLVED,
    close: EventTypes.SUPPORT_TICKET_CLOSED,
    reopen: EventTypes.SUPPORT_TICKET_UPDATED,
    cancel: EventTypes.SUPPORT_TICKET_CANCELLED,
  };

function toAttachmentDto(
  row: SupportTicketRecord['attachments'][number],
): SupportTicketAttachmentDto {
  return {
    id: row.id,
    mediaId: row.mediaId,
    kind: row.kind,
    messageId: row.messageId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMessageDto(
  ticket: SupportTicketRecord,
  message: SupportTicketRecord['messages'][number],
): SupportTicketMessageDto {
  return {
    id: message.id,
    authorId: message.authorId,
    authorType: message.authorType,
    content: message.content,
    attachments: ticket.attachments
      .filter((a) => !a.deletedAt && a.messageId === message.id)
      .map(toAttachmentDto),
    createdAt: message.createdAt.toISOString(),
  };
}

function toHistoryDto(
  row: SupportTicketRecord['history'][number],
): SupportTicketHistoryDto {
  return {
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTicketDto(
  ticket: SupportTicketRecord,
  opts: { includeCustomerId: boolean },
): SupportTicketDto {
  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    customerId: opts.includeCustomerId ? ticket.customerId : undefined,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    orderId: ticket.orderId,
    warrantyClaimId: ticket.warrantyClaimId,
    returnRequestId: ticket.returnRequestId,
    assigneeId: ticket.assigneeId,
    attachments: ticket.attachments
      .filter((a) => !a.deletedAt && !a.messageId)
      .map(toAttachmentDto),
    messageCount: ticket.messages.length,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function toTicketDetailDto(
  ticket: SupportTicketRecord,
  opts: { includeCustomerId: boolean },
): SupportTicketDetailDto {
  const base = toTicketDto(ticket, opts);
  return {
    ...base,
    customerId: ticket.customerId,
    messages: ticket.messages.map((m) => toMessageDto(ticket, m)),
    history: ticket.history.map(toHistoryDto),
  };
}

export class SupportService {
  constructor(
    private readonly repository: SupportRepository,
    private readonly orderClient: OrderClient,
    private readonly mediaClient: MediaClient,
    private readonly publisher: SupportEventPublisher,
  ) {}

  private async withIdempotency<T>(
    key: string | undefined,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return fn();
    }
    const existing = await this.repository.getIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
        });
      }
      return existing.response as T;
    }
    const result = await fn();
    await this.repository.saveIdempotency(key, operation, result);
    return result;
  }

  private async flushOutboxHint(traceId: string): Promise<void> {
    const unpublished = await this.repository.listUnpublishedOutbox(20);
    for (const event of unpublished) {
      if (event.traceId !== traceId) {
        continue;
      }
      await this.publisher.publish(
        createEventEnvelope({
          eventType: event.eventType as EventType,
          producer: 'support-service',
          traceId: event.traceId,
          payload: event.payload,
          eventId: event.id,
        }),
      );
      await this.repository.markOutboxPublished([event.id]);
    }
  }

  private async validateMediaIds(
    actor: Actor,
    mediaIds: string[] | undefined,
  ): Promise<Array<{ mediaId: string; kind: SupportMediaKind }>> {
    const mediaInputs: Array<{ mediaId: string; kind: SupportMediaKind }> = [];
    if (!mediaIds?.length) {
      return mediaInputs;
    }
    if (mediaIds.length > SUPPORT_LIMITS.MAX_ATTACHMENTS) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT,
        message: `Tối đa ${SUPPORT_LIMITS.MAX_ATTACHMENTS} tệp đính kèm`,
      });
    }
    for (const mediaId of mediaIds) {
      const media = await this.mediaClient.getMedia(mediaId);
      if (!media || media.status === 'deleted') {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_MEDIA_NOT_FOUND,
          message: 'Không tìm thấy media',
          details: { mediaId },
        });
      }
      if (media.uploadedBy !== actor.userId && !isStaff(actor)) {
        throw new AppError({
          errorCode: ErrorCodes.SUPPORT_MEDIA_FORBIDDEN,
          message: 'Media không thuộc về bạn',
          details: { mediaId },
        });
      }
      const kind = kindFromMime(media.mimeType);
      mediaInputs.push({ mediaId, kind });
    }
    return mediaInputs;
  }

  /** ===================== Customer ===================== */

  async createTicket(actor: Actor, body: unknown, traceId = createId()) {
    requireAuth(actor);
    if (isStaff(actor)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Chỉ khách hàng mới có thể tạo yêu cầu hỗ trợ',
      });
    }
    const input = createSupportTicketRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      'createSupportTicket',
      async () => {
        if (input.warrantyClaimId && input.returnRequestId) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_LINK_INVALID,
            message:
              'Chỉ được liên kết một trong hai: yêu cầu bảo hành hoặc yêu cầu đổi trả',
          });
        }

        let orderId: string | undefined;
        if (input.orderId) {
          const order = await this.orderClient.getOrder(input.orderId, {
            userId: actor.userId,
            roles: actor.roles,
            traceId,
          });
          if (order.customerId !== actor.userId) {
            throw new AppError({
              errorCode: ErrorCodes.SUPPORT_ORDER_FORBIDDEN,
              message: 'Đơn hàng không thuộc về bạn',
            });
          }
          orderId = order.id;
        }

        const subject = sanitizeText(input.subject);
        const description = sanitizeText(input.description);
        const mediaInputs = await this.validateMediaIds(actor, input.mediaIds);

        const ticketCode = generateTicketCode();
        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.SUPPORT_TICKET_CREATED,
            {
              ticketCode,
              category: input.category,
              priority: input.priority,
              orderId,
            },
            traceId,
          ),
        ];

        const ticket = await this.repository.createTicket({
          ticketCode,
          customerId: actor.userId,
          category: input.category,
          priority: input.priority,
          subject,
          description,
          orderId,
          warrantyClaimId: input.warrantyClaimId,
          returnRequestId: input.returnRequestId,
          attachments: mediaInputs,
          outbox,
          audit: {
            action: 'support.ticket.create',
            actorId: actor.userId,
            details: { category: input.category, orderId },
          },
        });

        await this.flushOutboxHint(traceId);
        return toTicketDetailDto(ticket, { includeCustomerId: true });
      },
    );
  }

  async getTicket(
    actor: Actor,
    ticketId: string,
  ): Promise<SupportTicketDetailDto> {
    requireAuth(actor);
    const ticket = await this.repository.findTicketById(ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    const staff = isStaff(actor);
    if (ticket.customerId !== actor.userId && !staff) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_FORBIDDEN,
        message: 'Không có quyền xem yêu cầu hỗ trợ này',
      });
    }
    return toTicketDetailDto(ticket, { includeCustomerId: true });
  }

  async listMyTickets(actor: Actor, query: Record<string, unknown>) {
    requireAuth(actor);
    const parsed = listSupportTicketsQuerySchema.parse(query);
    const result = await this.repository.listTickets({
      customerId: actor.userId,
      status: parsed.status,
      category: parsed.category,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((t) => toTicketDto(t, { includeCustomerId: false })),
      result.totalItems,
      parsed,
    );
  }

  async addMessage(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = addSupportTicketMessageRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `addMessage:${ticketId}`,
      async () => {
        const ticket = await this.repository.findTicketById(ticketId);
        if (!ticket) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu hỗ trợ',
          });
        }
        const staff = isStaff(actor);
        if (!staff && ticket.customerId !== actor.userId) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_FORBIDDEN,
            message: 'Không có quyền gửi tin nhắn cho yêu cầu hỗ trợ này',
          });
        }
        if (isTicketTerminal(ticket.status)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_CLOSED,
            message: 'Yêu cầu hỗ trợ đã kết thúc, không thể gửi tin nhắn',
          });
        }

        const content = sanitizeText(input.content);
        if (!content) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_MESSAGE_REQUIRED,
            message: 'Nội dung tin nhắn không được để trống',
          });
        }

        const mediaInputs = await this.validateMediaIds(actor, input.mediaIds);

        const authorType: SupportMessageAuthorType = staff
          ? 'STAFF'
          : 'CUSTOMER';
        const autoToStatus = !staff
          ? resolveCustomerMessageTransition(ticket.status)
          : undefined;
        const statusTransition = autoToStatus
          ? {
              fromStatus: ticket.status,
              toStatus: autoToStatus,
              action: 'customer_reply',
            }
          : undefined;

        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.SUPPORT_TICKET_MESSAGE_ADDED,
            { ticketId, authorType },
            traceId,
          ),
        ];
        if (statusTransition) {
          outbox.push(
            buildOutbox(
              EventTypes.SUPPORT_TICKET_UPDATED,
              {
                ticketId,
                from: statusTransition.fromStatus,
                to: statusTransition.toStatus,
              },
              traceId,
            ),
          );
        }

        const updated = await this.repository.addMessage({
          ticketId,
          authorId: actor.userId,
          authorType,
          content,
          attachments: mediaInputs,
          statusTransition,
          outbox,
          audit: {
            action: 'support.ticket.message',
            actorId: actor.userId,
            details: { ticketId, authorType },
          },
        });
        await this.flushOutboxHint(traceId);
        return toTicketDetailDto(updated, { includeCustomerId: true });
      },
    );
  }

  async attachTicketMedia(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = attachSupportTicketMediaRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `attachTicketMedia:${ticketId}:${input.mediaId}`,
      async () => {
        const ticket = await this.repository.findTicketById(ticketId);
        if (!ticket) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu hỗ trợ',
          });
        }
        if (ticket.customerId !== actor.userId && !isStaff(actor)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_FORBIDDEN,
            message: 'Không có quyền gắn tệp đính kèm',
          });
        }
        if (isTicketTerminal(ticket.status)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_CLOSED,
            message: 'Yêu cầu hỗ trợ đã kết thúc, không thể thêm tệp đính kèm',
          });
        }
        const [media] = await this.validateMediaIds(actor, [input.mediaId]);
        const updated = await this.repository.attachMedia({
          ticketId,
          mediaId: media.mediaId,
          kind: media.kind,
          outbox: [
            buildOutbox(
              EventTypes.SUPPORT_TICKET_UPDATED,
              { ticketId, mediaId: input.mediaId, action: 'attach-media' },
              traceId,
            ),
          ],
        });
        await this.flushOutboxHint(traceId);
        return toTicketDto(updated, { includeCustomerId: true });
      },
    );
  }

  private async applyTicketTransition(
    actor: Actor,
    ticketId: string,
    action: SupportTicketTransitionAction,
    opts: {
      reason?: string;
      expectedVersion?: number;
      requireOwnership: boolean;
      allowedStatuses?: SupportTicketStatus[];
    },
    traceId: string,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.repository.findTicketById(ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    if (opts.requireOwnership && ticket.customerId !== actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_FORBIDDEN,
        message: 'Không có quyền thao tác yêu cầu hỗ trợ này',
      });
    }
    if (opts.allowedStatuses && !opts.allowedStatuses.includes(ticket.status)) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
        message: 'Không thể hủy yêu cầu hỗ trợ ở trạng thái hiện tại',
        details: { status: ticket.status },
      });
    }
    const toStatus = resolveTicketTransition(ticket.status, action);

    const outbox: OutboxEventInput[] = [
      buildOutbox(
        TICKET_EVENT_BY_ACTION[action],
        {
          ticketId,
          from: ticket.status,
          to: toStatus,
          reason: opts.reason,
        },
        traceId,
      ),
    ];

    const updated = await this.repository.transitionTicket({
      ticketId,
      expectedVersion: opts.expectedVersion,
      fromStatus: ticket.status,
      toStatus,
      action,
      actorId: actor.userId,
      actorType: isStaff(actor) ? 'staff' : 'customer',
      reason: opts.reason,
      outbox,
      audit: {
        action: `support.ticket.${action}`,
        actorId: actor.userId,
        details: { ticketId, reason: opts.reason },
      },
    });
    await this.flushOutboxHint(traceId);
    return toTicketDetailDto(updated, { includeCustomerId: true });
  }

  async cancelTicket(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = cancelSupportTicketRequestSchema.parse(body ?? {});
    const staff = isStaff(actor);
    return this.withIdempotency(
      input.idempotencyKey,
      `cancelTicket:${ticketId}`,
      () =>
        this.applyTicketTransition(
          actor,
          ticketId,
          'cancel',
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: !staff,
            allowedStatuses: staff ? undefined : ['OPEN', 'WAITING_CUSTOMER'],
          },
          traceId,
        ),
    );
  }

  /** ===================== Admin ===================== */

  async adminListTickets(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listAdminSupportTicketsQuerySchema.parse(query);
    const result = await this.repository.listTickets({
      status: parsed.status,
      category: parsed.category,
      priority: parsed.priority,
      customerId: parsed.customerId,
      assigneeId: parsed.assigneeId,
      orderId: parsed.orderId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((t) => toTicketDto(t, { includeCustomerId: true })),
      result.totalItems,
      parsed,
    );
  }

  async adminGetTicket(
    actor: Actor,
    ticketId: string,
  ): Promise<AdminSupportTicketDetailDto> {
    requireStaff(actor);
    const ticket = await this.repository.findTicketById(ticketId);
    if (!ticket) {
      throw new AppError({
        errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu hỗ trợ',
      });
    }
    return toTicketDetailDto(ticket, { includeCustomerId: true });
  }

  async adminTransitionTicket(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = transitionSupportTicketRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `adminTransitionTicket:${ticketId}:${input.action}`,
      () =>
        this.applyTicketTransition(
          actor,
          ticketId,
          input.action,
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: false,
          },
          traceId,
        ),
    );
  }

  async adminAddMessage(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    return this.addMessage(actor, ticketId, body, traceId);
  }

  async adminAssignTicket(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = assignSupportTicketRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `assignTicket:${ticketId}:${input.assigneeId}`,
      async () => {
        const ticket = await this.repository.findTicketById(ticketId);
        if (!ticket) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu hỗ trợ',
          });
        }
        if (isTicketTerminal(ticket.status)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
            message: 'Yêu cầu hỗ trợ đã kết thúc, không thể phân công',
          });
        }
        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.SUPPORT_TICKET_ASSIGNED,
            { ticketId, assigneeId: input.assigneeId },
            traceId,
          ),
        ];
        const updated = await this.repository.assignTicket({
          ticketId,
          expectedVersion: input.expectedVersion,
          assigneeId: input.assigneeId,
          actorId: actor.userId,
          actorType: 'staff',
          outbox,
          audit: {
            action: 'support.ticket.assign',
            actorId: actor.userId,
            details: { ticketId, assigneeId: input.assigneeId },
          },
        });
        await this.flushOutboxHint(traceId);
        return toTicketDetailDto(updated, { includeCustomerId: true });
      },
    );
  }

  async adminUpdatePriority(
    actor: Actor,
    ticketId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = updateSupportTicketPriorityRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `updatePriority:${ticketId}:${input.priority}`,
      async () => {
        const ticket = await this.repository.findTicketById(ticketId);
        if (!ticket) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu hỗ trợ',
          });
        }
        if (isTicketTerminal(ticket.status)) {
          throw new AppError({
            errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
            message: 'Yêu cầu hỗ trợ đã kết thúc, không thể đổi độ ưu tiên',
          });
        }
        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.SUPPORT_TICKET_UPDATED,
            { ticketId, priority: input.priority },
            traceId,
          ),
        ];
        const updated = await this.repository.updatePriority({
          ticketId,
          expectedVersion: input.expectedVersion,
          priority: input.priority,
          actorId: actor.userId,
          actorType: 'staff',
          outbox,
          audit: {
            action: 'support.ticket.update_priority',
            actorId: actor.userId,
            details: { ticketId, priority: input.priority },
          },
        });
        await this.flushOutboxHint(traceId);
        return toTicketDetailDto(updated, { includeCustomerId: true });
      },
    );
  }
}
