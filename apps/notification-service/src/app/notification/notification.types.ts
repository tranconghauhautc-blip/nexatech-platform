import type {
  EmailDeliveryStatus,
  NotificationCategory,
} from '@nexatech/shared-contracts';

export interface Actor {
  userId: string;
  roles: string[];
}

/** ---------- In-app notification ---------- */

export interface InAppNotificationRecord {
  id: string;
  userId: string;
  category: NotificationCategory;
  templateKey: string;
  title: string;
  body: string;
  linkUrl?: string;
  sourceEventId?: string;
  sourceEventType?: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
}

export interface CreateInAppInput {
  userId: string;
  category: NotificationCategory;
  templateKey: string;
  title: string;
  body: string;
  linkUrl?: string;
  sourceEventId?: string;
  sourceEventType?: string;
  data?: Record<string, unknown>;
}

export interface ListInAppFilter {
  unreadOnly?: boolean;
  category?: NotificationCategory;
  page: number;
  pageSize: number;
}

export interface ListInAppResult {
  items: InAppNotificationRecord[];
  totalItems: number;
}

/** ---------- Email delivery ---------- */

export interface EmailDeliveryRecord {
  id: string;
  toEmail: string;
  userId?: string;
  templateKey: string;
  subject: string;
  bodyText: string;
  status: EmailDeliveryStatus;
  attempts: number;
  lastError?: string;
  sourceEventId?: string;
  data?: Record<string, unknown>;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailDeliveryInput {
  toEmail: string;
  userId?: string;
  templateKey: string;
  subject: string;
  bodyText: string;
  status: EmailDeliveryStatus;
  sourceEventId?: string;
  data?: Record<string, unknown>;
}

export interface UpdateEmailDeliveryInput {
  id: string;
  status: EmailDeliveryStatus;
  attempts: number;
  lastError?: string;
  sentAt?: Date;
}

export interface ListEmailByStatusFilter {
  status?: EmailDeliveryStatus;
  page: number;
  pageSize: number;
}

export interface ListEmailResult {
  items: EmailDeliveryRecord[];
  totalItems: number;
}

/** ---------- Inbox pattern (event idempotency) ---------- */

export interface ProcessedEventRecord {
  eventId: string;
  eventType: string;
  routingKey?: string;
  processedAt: Date;
  result?: unknown;
}

/** ---------- Idempotency (REST) ---------- */

export interface IdempotencyRecord {
  key: string;
  operation: string;
  response: unknown;
  createdAt: Date;
}

/** ---------- Audit ---------- */

export interface AuditInput {
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
}
