import type {
  DesiredResolution,
  ReturnReason,
  ReturnRequestStatus,
  WarrantyClaimStatus,
  WarrantyIssueType,
  WarrantyMediaKind,
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

export interface OrderItemSnapshot {
  id: string;
  skuId: string;
  skuCode: string;
  productId: string;
  productName: string;
  quantity: number;
}

export interface OrderPackageSnapshot {
  id: string;
  status: string;
  items: Array<{ orderItemId: string }>;
}

export interface OrderSnapshot {
  id: string;
  orderCode: string;
  customerId: string;
  status: string;
  items: OrderItemSnapshot[];
  packages: OrderPackageSnapshot[];
}

export type OrderReturnSyncStatus =
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'DELIVERED';

export interface SyncReturnInput {
  orderItemId: string;
  toStatus: OrderReturnSyncStatus;
  idempotencyKey?: string;
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

/** ---------- Warranty claim ---------- */

export interface WarrantyClaimMediaRecord {
  id: string;
  claimId: string;
  mediaId: string;
  kind: WarrantyMediaKind;
  deletedAt?: Date;
  createdAt: Date;
}

export interface WarrantyClaimHistoryRecord {
  id: string;
  claimId: string;
  fromStatus?: WarrantyClaimStatus;
  toStatus: WarrantyClaimStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface WarrantyClaimRecord {
  id: string;
  claimCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  issueType: WarrantyIssueType;
  description: string;
  serialNumber?: string;
  status: WarrantyClaimStatus;
  activeKey: string;
  version: number;
  orderSyncedStatus?: string;
  orderSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  media: WarrantyClaimMediaRecord[];
  history: WarrantyClaimHistoryRecord[];
}

export interface CreateClaimInput {
  claimCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  issueType: WarrantyIssueType;
  description: string;
  serialNumber?: string;
  activeKey: string;
  media?: Array<{ mediaId: string; kind: WarrantyMediaKind }>;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface TransitionClaimInput {
  claimId: string;
  expectedVersion?: number;
  fromStatus: WarrantyClaimStatus;
  toStatus: WarrantyClaimStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  rotateActiveKey?: string;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface ListClaimsFilter {
  customerId?: string;
  status?: WarrantyClaimStatus;
  orderId?: string;
  from?: Date;
  to?: Date;
  sort: 'newest' | 'oldest';
  page: number;
  pageSize: number;
}

export interface ListClaimsResult {
  items: WarrantyClaimRecord[];
  totalItems: number;
}

/** ---------- Return request ---------- */

export interface ReturnRequestMediaRecord {
  id: string;
  returnId: string;
  mediaId: string;
  kind: WarrantyMediaKind;
  deletedAt?: Date;
  createdAt: Date;
}

export interface ReturnRequestHistoryRecord {
  id: string;
  returnId: string;
  fromStatus?: ReturnRequestStatus;
  toStatus: ReturnRequestStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface ReturnRequestRecord {
  id: string;
  returnCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  reason: ReturnReason;
  description: string;
  quantity: number;
  desiredResolution: DesiredResolution;
  status: ReturnRequestStatus;
  activeKey: string;
  version: number;
  orderSyncedStatus?: string;
  orderSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  media: ReturnRequestMediaRecord[];
  history: ReturnRequestHistoryRecord[];
}

export interface CreateReturnInput {
  returnCode: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  customerId: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  productName: string;
  reason: ReturnReason;
  description: string;
  quantity: number;
  desiredResolution: DesiredResolution;
  activeKey: string;
  media?: Array<{ mediaId: string; kind: WarrantyMediaKind }>;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface OrderSyncUpdate {
  status: string;
  syncedAt: Date;
}

export interface TransitionReturnInput {
  returnId: string;
  expectedVersion?: number;
  fromStatus: ReturnRequestStatus;
  toStatus: ReturnRequestStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  rotateActiveKey?: string;
  orderSync?: OrderSyncUpdate;
  outbox: OutboxEventInput[];
  audit?: AuditInput;
}

export interface ListReturnsFilter {
  customerId?: string;
  status?: ReturnRequestStatus;
  orderId?: string;
  from?: Date;
  to?: Date;
  sort: 'newest' | 'oldest';
  page: number;
  pageSize: number;
}

export interface ListReturnsResult {
  items: ReturnRequestRecord[];
  totalItems: number;
}
