import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
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

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRepository {
  createInApp(input: CreateInAppInput): Promise<InAppNotificationRecord>;
  findInAppById(id: string): Promise<InAppNotificationRecord | null>;
  listInApp(userId: string, filter: ListInAppFilter): Promise<ListInAppResult>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<InAppNotificationRecord>;
  markAllRead(userId: string): Promise<number>;
  softDelete(id: string, userId: string): Promise<void>;

  createEmailDelivery(
    input: CreateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord>;
  updateEmailDelivery(
    input: UpdateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord>;
  listEmailByStatus(filter: ListEmailByStatusFilter): Promise<ListEmailResult>;

  /** Inbox pattern: returns false if eventId already processed (unique PK). */
  tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean>;
  isProcessed(eventId: string): Promise<boolean>;

  getIdempotency(key: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void>;

  writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private inApp = new Map<string, InAppNotificationRecord>();
  private emails = new Map<string, EmailDeliveryRecord>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private processed = new Map<string, ProcessedEntry>();
  private audits: Array<{
    id: string;
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  clear(): void {
    this.inApp.clear();
    this.emails.clear();
    this.idempotency.clear();
    this.processed.clear();
    this.audits = [];
  }

  async createInApp(input: CreateInAppInput): Promise<InAppNotificationRecord> {
    const record: InAppNotificationRecord = {
      id: createId(),
      userId: input.userId,
      category: input.category,
      templateKey: input.templateKey,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      sourceEventId: input.sourceEventId,
      sourceEventType: input.sourceEventType,
      data: input.data,
      createdAt: new Date(),
    };
    this.inApp.set(record.id, record);
    return { ...record };
  }

  async findInAppById(id: string): Promise<InAppNotificationRecord | null> {
    const record = this.inApp.get(id);
    return record ? { ...record } : null;
  }

  async listInApp(
    userId: string,
    filter: ListInAppFilter,
  ): Promise<ListInAppResult> {
    let items = [...this.inApp.values()].filter(
      (n) => n.userId === userId && !n.deletedAt,
    );
    if (filter.unreadOnly) {
      items = items.filter((n) => !n.readAt);
    }
    if (filter.category) {
      items = items.filter((n) => n.category === filter.category);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map((n) => ({ ...n })),
      totalItems,
    };
  }

  async countUnread(userId: string): Promise<number> {
    return [...this.inApp.values()].filter(
      (n) => n.userId === userId && !n.deletedAt && !n.readAt,
    ).length;
  }

  async markRead(id: string, userId: string): Promise<InAppNotificationRecord> {
    const record = this.inApp.get(id);
    if (!record || record.deletedAt || record.userId !== userId) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
    record.readAt = new Date();
    return { ...record };
  }

  async markAllRead(userId: string): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const record of this.inApp.values()) {
      if (record.userId === userId && !record.deletedAt && !record.readAt) {
        record.readAt = now;
        count += 1;
      }
    }
    return count;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const record = this.inApp.get(id);
    if (!record || record.deletedAt || record.userId !== userId) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy thông báo',
      });
    }
    record.deletedAt = new Date();
  }

  async createEmailDelivery(
    input: CreateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord> {
    const now = new Date();
    const record: EmailDeliveryRecord = {
      id: createId(),
      toEmail: input.toEmail,
      userId: input.userId,
      templateKey: input.templateKey,
      subject: input.subject,
      bodyText: input.bodyText,
      status: input.status,
      attempts: 0,
      sourceEventId: input.sourceEventId,
      data: input.data,
      createdAt: now,
      updatedAt: now,
    };
    this.emails.set(record.id, record);
    return { ...record };
  }

  async updateEmailDelivery(
    input: UpdateEmailDeliveryInput,
  ): Promise<EmailDeliveryRecord> {
    const record = this.emails.get(input.id);
    if (!record) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: 'Không tìm thấy email thông báo',
      });
    }
    record.status = input.status;
    record.attempts = input.attempts;
    record.lastError = input.lastError;
    record.sentAt = input.sentAt;
    record.updatedAt = new Date();
    return { ...record };
  }

  async listEmailByStatus(
    filter: ListEmailByStatusFilter,
  ): Promise<ListEmailResult> {
    let items = [...this.emails.values()];
    if (filter.status) {
      items = items.filter((e) => e.status === filter.status);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map((e) => ({ ...e })),
      totalItems,
    };
  }

  async tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean> {
    if (this.processed.has(eventId)) {
      return false;
    }
    this.processed.set(eventId, {
      eventId,
      eventType,
      routingKey,
      processedAt: new Date(),
      result,
    });
    return true;
  }

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const record = this.idempotency.get(key);
    return record ? { ...record } : null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    if (this.idempotency.has(key)) {
      throw new AppError({
        errorCode: ErrorCodes.NOTIFICATION_IDEMPOTENCY_CONFLICT,
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

interface ProcessedEntry {
  eventId: string;
  eventType: string;
  routingKey?: string;
  processedAt: Date;
  result?: unknown;
}
