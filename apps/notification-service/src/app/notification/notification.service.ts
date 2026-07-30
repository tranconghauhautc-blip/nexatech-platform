import { createId } from '@nexatech/shared-platform';
import {
  createPaginatedResponse,
  emailDeliveryStatusSchema,
  listNotificationsQuerySchema,
  NOTIFICATION_LIMITS,
  requestNotificationSchema,
  type EmailDeliveryDto,
  type EmailDeliveryStatus,
  type InAppNotificationDto,
  type RequestNotificationResultDto,
  type UnreadCountDto,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  routingKeyFor,
  type EventEnvelope,
  type EventType,
} from '@nexatech/shared-events';
import { z } from 'zod';
import type { EmailSender } from './email.sender';
import { extractNotification } from './event-handlers';
import type { NotificationRepository } from './notification.repository';
import { hasTemplate, renderTemplate } from './templates';
import type {
  Actor,
  CreateEmailDeliveryInput,
  EmailDeliveryRecord,
  InAppNotificationRecord,
} from './notification.types';

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

const listEmailDeliveriesQuerySchema = z.object({
  status: emailDeliveryStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(NOTIFICATION_LIMITS.pageSizeMax)
    .default(NOTIFICATION_LIMITS.defaultPageSize),
});

function toInAppDto(record: InAppNotificationRecord): InAppNotificationDto {
  return {
    id: record.id,
    userId: record.userId,
    category: record.category,
    templateKey: record.templateKey,
    title: record.title,
    body: record.body,
    linkUrl: record.linkUrl,
    readAt: record.readAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

function toEmailDto(record: EmailDeliveryRecord): EmailDeliveryDto {
  return {
    id: record.id,
    toEmail: record.toEmail,
    userId: record.userId,
    templateKey: record.templateKey,
    subject: record.subject,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    sentAt: record.sentAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export interface ProcessEventResult {
  processed: boolean;
  inApp?: InAppNotificationRecord;
  email?: EmailDeliveryRecord;
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly emailSender: EmailSender,
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
          errorCode: ErrorCodes.NOTIFICATION_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
        });
      }
      return existing.response as T;
    }
    const result = await fn();
    await this.repository.saveIdempotency(key, operation, result);
    return result;
  }

  private requireSmtp(): boolean {
    return process.env['NOTIFICATION_REQUIRE_SMTP'] === 'true';
  }

  private hasSmtpConfigured(): boolean {
    return Boolean(process.env['SMTP_HOST']);
  }

  /** Tạo bản ghi email và cố gắng gửi, cập nhật trạng thái theo kết quả. */
  private async deliverEmail(
    input: CreateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord> {
    const delivery = await this.repository.createEmailDelivery(input);

    if (
      this.requireSmtp() &&
      !this.hasSmtpConfigured() &&
      process.env['NODE_ENV'] !== 'test'
    ) {
      return this.repository.updateEmailDelivery({
        id: delivery.id,
        status: 'SKIPPED',
        attempts: delivery.attempts,
        lastError: 'SMTP chưa được cấu hình',
      });
    }

    try {
      await this.emailSender.send({
        to: delivery.toEmail,
        subject: delivery.subject,
        text: delivery.bodyText,
      });
      return this.repository.updateEmailDelivery({
        id: delivery.id,
        status: 'SENT',
        attempts: delivery.attempts + 1,
        sentAt: new Date(),
      });
    } catch (error) {
      return this.repository.updateEmailDelivery({
        id: delivery.id,
        status: 'FAILED',
        attempts: delivery.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** ===================== Event consumption (inbox pattern) ===================== */

  async processEventEnvelope(
    envelope: EventEnvelope,
  ): Promise<ProcessEventResult> {
    if (await this.repository.isProcessed(envelope.eventId)) {
      return { processed: false };
    }

    const extracted = extractNotification(envelope);
    let inApp: InAppNotificationRecord | undefined;
    let email: EmailDeliveryRecord | undefined;

    if (extracted) {
      if (extracted.userId) {
        inApp = await this.repository.createInApp({
          userId: extracted.userId,
          category: extracted.category,
          templateKey: extracted.templateKey,
          title: extracted.title,
          body: extracted.body,
          linkUrl: extracted.linkUrl,
          sourceEventId: envelope.eventId,
          sourceEventType: envelope.eventType,
          data: extracted.data,
        });
      }
      if (extracted.email) {
        email = await this.deliverEmail({
          toEmail: extracted.email,
          userId: extracted.userId,
          templateKey: extracted.templateKey,
          subject: extracted.subject,
          bodyText: extracted.body,
          status: 'PENDING',
          sourceEventId: envelope.eventId,
          data: extracted.data,
        });
      }
    }

    let routingKey: string | undefined;
    try {
      routingKey = routingKeyFor(envelope.eventType as EventType);
    } catch {
      routingKey = undefined;
    }

    const wasNew = await this.repository.tryMarkProcessed(
      envelope.eventId,
      envelope.eventType,
      routingKey,
      { inAppId: inApp?.id, emailId: email?.id, skipped: !extracted },
    );

    if (wasNew) {
      await this.repository.writeAudit(
        'notification.event.processed',
        'system',
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          inAppId: inApp?.id,
          emailId: email?.id,
        },
      );
    }

    return { processed: wasNew, inApp, email };
  }

  /** ===================== REST — staff-triggered notification ===================== */

  async requestNotification(
    actor: Actor,
    body: unknown,
    traceId = createId(),
    headerIdempotencyKey?: string,
  ): Promise<RequestNotificationResultDto> {
    requireStaff(actor);
    void traceId;
    const rawBody = (body ?? {}) as Record<string, unknown>;
    const merged =
      headerIdempotencyKey && rawBody['idempotencyKey'] === undefined
        ? { ...rawBody, idempotencyKey: headerIdempotencyKey }
        : rawBody;
    const input = requestNotificationSchema.parse(merged);

    if (!input.userId && !input.email) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_RECIPIENT_REQUIRED,
        message: 'Cần userId hoặc email để gửi thông báo',
      });
    }

    return this.withIdempotency(
      input.idempotencyKey,
      'requestNotification',
      async () => {
        const dataForTemplate: Record<string, unknown> = {
          ...(input.data ?? {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
        };

        const category = input.category;
        let title = input.title;
        let subject = input.title;
        let renderedBody = input.body;

        if (hasTemplate(input.templateKey)) {
          const rendered = renderTemplate(input.templateKey, dataForTemplate);
          title = title ?? rendered.title;
          subject = subject ?? rendered.subject;
          renderedBody = renderedBody ?? rendered.body;
        }

        if (!title || !renderedBody) {
          throw new AppError({
            errorCode: ErrorCodes.NOTIFICATION_TEMPLATE_NOT_FOUND,
            message: `Không tìm thấy mẫu thông báo: ${input.templateKey}`,
            details: { templateKey: input.templateKey },
          });
        }

        let inApp: InAppNotificationRecord | undefined;
        let email: EmailDeliveryRecord | undefined;

        if (input.channels.includes('IN_APP') && input.userId) {
          inApp = await this.repository.createInApp({
            userId: input.userId,
            category,
            templateKey: input.templateKey,
            title,
            body: renderedBody,
            linkUrl: input.linkUrl,
            data: input.data,
          });
        }

        if (input.channels.includes('EMAIL') && input.email) {
          email = await this.deliverEmail({
            toEmail: input.email,
            userId: input.userId,
            templateKey: input.templateKey,
            subject: subject ?? title,
            bodyText: renderedBody,
            status: 'PENDING',
            data: input.data,
          });
        }

        await this.repository.writeAudit(
          'notification.requested',
          actor.userId,
          {
            templateKey: input.templateKey,
            userId: input.userId,
            email: input.email,
          },
        );

        return {
          inApp: inApp ? toInAppDto(inApp) : undefined,
          email: email ? toEmailDto(email) : undefined,
        };
      },
    );
  }

  /** ===================== REST — self-service inbox ===================== */

  async listNotifications(actor: Actor, query: Record<string, unknown>) {
    requireAuth(actor);
    const parsed = listNotificationsQuerySchema.parse(query);
    const result = await this.repository.listInApp(actor.userId, {
      unreadOnly: parsed.unreadOnly,
      category: parsed.category,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map(toInAppDto),
      result.totalItems,
      parsed,
    );
  }

  async unreadCount(actor: Actor): Promise<UnreadCountDto> {
    requireAuth(actor);
    const count = await this.repository.countUnread(actor.userId);
    return { count };
  }

  async markRead(actor: Actor, id: string): Promise<InAppNotificationDto> {
    requireAuth(actor);
    const notification = await this.repository.findInAppById(id);
    if (!notification || notification.deletedAt) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
    if (notification.userId !== actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_FORBIDDEN,
        message: 'Không có quyền với thông báo này',
      });
    }
    if (notification.readAt) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_ALREADY_READ,
        message: 'Thông báo đã được đánh dấu đã đọc',
      });
    }
    const updated = await this.repository.markRead(id, actor.userId);
    return toInAppDto(updated);
  }

  async markAllRead(actor: Actor): Promise<{ updated: number }> {
    requireAuth(actor);
    const updated = await this.repository.markAllRead(actor.userId);
    return { updated };
  }

  async deleteNotification(actor: Actor, id: string): Promise<void> {
    requireAuth(actor);
    const notification = await this.repository.findInAppById(id);
    if (!notification || notification.deletedAt) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
    if (notification.userId !== actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_FORBIDDEN,
        message: 'Không có quyền với thông báo này',
      });
    }
    await this.repository.softDelete(id, actor.userId);
  }

  /** ===================== Admin ===================== */

  async listEmailDeliveries(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listEmailDeliveriesQuerySchema.parse(query);
    const result = await this.repository.listEmailByStatus({
      status: parsed.status as EmailDeliveryStatus | undefined,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map(toEmailDto),
      result.totalItems,
      parsed,
    );
  }
}
