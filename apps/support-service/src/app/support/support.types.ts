import type {
  SupportMediaKind,
  SupportMessageAuthorType,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@nexatech/shared-contracts';

export interface Actor {
  userId: string;
  roles: string[];
}

export interface OrderClientHeaders {
  userId?: string;
  roles?: string[];
  traceId?: string;
}

export interface OrderSnapshot {
  id: string;
  orderCode: string;
  customerId: string;
  status: string;
}

export interface MediaSnapshot {
  id: string;
  uploadedBy: string;
  mimeType: string;
  status: string;
  sizeBytes?: number;
}

export interface OutboxEventInput {
  eventType: string;
  routingKey: string;
  payload: Record<string, unknown>;
  traceId: string;
}

export interface OutboxEventRecord extends OutboxEventInput {
  id: string;
  publishedAt?: Date;
  createdAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  response: unknown;
  createdAt: Date;
}

export interface AuditInput {
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
}

/** ---------- Support ticket ---------- */

export interface SupportTicketAttachmentRecord {
  id: string;
  ticketId: string;
  messageId?: string;
  mediaId: string;
  kind: SupportMediaKind;
  deletedAt?: Date;
  createdAt: Date;
}

export interface SupportTicketMessageRecord {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: SupportMessageAuthorType;
  content: string;
  createdAt: Date;
}

export interface SupportTicketHistoryRecord {
  id: string;
  ticketId: string;
  fromStatus?: SupportTicketStatus;
  toStatus: SupportTicketStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface SupportTicketRecord {
  id: string;
  ticketCode: string;
  customerId: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  orderId?: string;
  warrantyClaimId?: string;
  returnRequestId?: string;
  assigneeId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  /** Toàn bộ tệp đính kèm của ticket, bao gồm cả loại gắn trực tiếp và gắn vào tin nhắn (qua messageId). */
  attachments: SupportTicketAttachmentRecord[];
  messages: SupportTicketMessageRecord[];
  history: SupportTicketHistoryRecord[];
}

export interface CreateTicketInput {
  ticketCode: string;
  customerId: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  orderId?: string;
  warrantyClaimId?: string;
  returnRequestId?: string;
  attachments?: Array<{ mediaId: string; kind: SupportMediaKind }>;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface TransitionTicketInput {
  ticketId: string;
  expectedVersion?: number;
  fromStatus: SupportTicketStatus;
  toStatus: SupportTicketStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface AssignTicketInput {
  ticketId: string;
  expectedVersion?: number;
  assigneeId: string;
  actorId: string;
  actorType: string;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface UpdatePriorityInput {
  ticketId: string;
  expectedVersion?: number;
  priority: SupportTicketPriority;
  actorId: string;
  actorType: string;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface AddMessageStatusTransition {
  fromStatus: SupportTicketStatus;
  toStatus: SupportTicketStatus;
  action: string;
}

export interface AddMessageInput {
  ticketId: string;
  authorId: string;
  authorType: SupportMessageAuthorType;
  content: string;
  attachments?: Array<{ mediaId: string; kind: SupportMediaKind }>;
  statusTransition?: AddMessageStatusTransition;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface AttachTicketMediaInput {
  ticketId: string;
  mediaId: string;
  kind: SupportMediaKind;
  outbox: OutboxEventInput[];
}

export interface ListTicketsFilter {
  customerId?: string;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  priority?: SupportTicketPriority;
  assigneeId?: string;
  orderId?: string;
  from?: Date;
  to?: Date;
  sort: 'newest' | 'oldest';
  page: number;
  pageSize: number;
}

export interface ListTicketsResult {
  items: SupportTicketRecord[];
  totalItems: number;
}
