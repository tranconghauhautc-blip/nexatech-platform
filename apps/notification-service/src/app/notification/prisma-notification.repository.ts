import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from './prisma.service';
import type { NotificationRepository } from './notification.repository';
import type {
  CreateEmailDeliveryInput,
  CreateInAppInput,
  EmailDeliveryRecord,
  IdempotencyRecord,
  InAppNotificationRecord,
  ListEmailByStatusFilter,
  ListEmailResult,
  ListInAppFilter,
  ListInAppResult,
  UpdateEmailDeliveryInput,
} from './notification.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

type PrismaInAppRow = Awaited<
  ReturnType<PrismaService['inAppNotification']['findFirstOrThrow']>
>;
type PrismaEmailRow = Awaited<
  ReturnType<PrismaService['emailDelivery']['findFirstOrThrow']>
>;

function mapInApp(row: PrismaInAppRow): InAppNotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    templateKey: row.templateKey,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl ?? undefined,
    sourceEventId: row.sourceEventId ?? undefined,
    sourceEventType: row.sourceEventType ?? undefined,
    data: (row.dataJson as Record<string, unknown> | null) ?? undefined,
    readAt: row.readAt ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapEmail(row: PrismaEmailRow): EmailDeliveryRecord {
  return {
    id: row.id,
    toEmail: row.toEmail,
    userId: row.userId ?? undefined,
    templateKey: row.templateKey,
    subject: row.subject,
    bodyText: row.bodyText,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError ?? undefined,
    sourceEventId: row.sourceEventId ?? undefined,
    data: (row.dataJson as Record<string, unknown> | null) ?? undefined,
    sentAt: row.sentAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInApp(input: CreateInAppInput): Promise<InAppNotificationRecord> {
    const row = await this.prisma.inAppNotification.create({
      data: {
        id: createId(),
        userId: input.userId,
        category: input.category,
        templateKey: input.templateKey,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        sourceEventId: input.sourceEventId,
        sourceEventType: input.sourceEventType,
        dataJson: input.data as Prisma.InputJsonValue | undefined,
      },
    });
    return mapInApp(row);
  }

  async findInAppById(id: string): Promise<InAppNotificationRecord | null> {
    const row = await this.prisma.inAppNotification.findUnique({
      where: { id },
    });
    return row ? mapInApp(row) : null;
  }

  async listInApp(
    userId: string,
    filter: ListInAppFilter,
  ): Promise<ListInAppResult> {
    const where: Prisma.InAppNotificationWhereInput = {
      userId,
      deletedAt: null,
    };
    if (filter.unreadOnly) {
      where.readAt = null;
    }
    if (filter.category) {
      where.category = filter.category;
    }
    const [rows, totalItems] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.inAppNotification.count({ where }),
    ]);
    return { items: rows.map(mapInApp), totalItems };
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: { userId, deletedAt: null, readAt: null },
    });
  }

  async markRead(id: string, userId: string): Promise<InAppNotificationRecord> {
    const updated = await this.prisma.inAppNotification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
    const row = await this.prisma.inAppNotification.findUniqueOrThrow({
      where: { id },
    });
    return mapInApp(row);
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await this.prisma.inAppNotification.updateMany({
      where: { userId, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return updated.count;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const updated = await this.prisma.inAppNotification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
  }

  async createEmailDelivery(
    input: CreateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord> {
    const row = await this.prisma.emailDelivery.create({
      data: {
        id: createId(),
        toEmail: input.toEmail,
        userId: input.userId,
        templateKey: input.templateKey,
        subject: input.subject,
        bodyText: input.bodyText,
        status: input.status,
        sourceEventId: input.sourceEventId,
        dataJson: input.data as Prisma.InputJsonValue | undefined,
      },
    });
    return mapEmail(row);
  }

  async updateEmailDelivery(
    input: UpdateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord> {
    const row = await this.prisma.emailDelivery.update({
      where: { id: input.id },
      data: {
        status: input.status,
        attempts: input.attempts,
        lastError: input.lastError,
        sentAt: input.sentAt,
      },
    });
    return mapEmail(row);
  }

  async listEmailByStatus(
    filter: ListEmailByStatusFilter,
  ): Promise<ListEmailResult> {
    const where: Prisma.EmailDeliveryWhereInput = {};
    if (filter.status) {
      where.status = filter.status;
    }
    const [rows, totalItems] = await Promise.all([
      this.prisma.emailDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.emailDelivery.count({ where }),
    ]);
    return { items: rows.map(mapEmail), totalItems };
  }

  async tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean> {
    try {
      await this.prisma.processedEvent.create({
        data: {
          eventId,
          eventType,
          routingKey,
          resultJson: result as Prisma.InputJsonValue | undefined,
        },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const row = await this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return Boolean(row);
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.notificationIdempotency.findUnique({
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
      await this.prisma.notificationIdempotency.create({
        data: {
          key,
          operation,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          errorCode: ErrorCodes.NOTIFICATION_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã được sử dụng',
        });
      }
      throw error;
    }
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
