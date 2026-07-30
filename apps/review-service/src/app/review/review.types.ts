import type {
  ReviewMediaKind,
  ReviewReportReason,
  ReviewReportStatus,
  ReviewStatus,
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
  customerSnapshot?: {
    displayName?: string;
  };
}

export interface CatalogProductSnapshot {
  id: string;
  name: string;
  status: string;
}

export interface MediaSnapshot {
  id: string;
  uploadedBy: string;
  mimeType: string;
  status: string;
  sizeBytes?: number;
}

export interface ReviewMediaRecord {
  id: string;
  reviewId: string;
  mediaId: string;
  kind: ReviewMediaKind;
  sortOrder: number;
  unlinkedAt?: Date;
  createdAt: Date;
}

export interface ReviewReplyRecord {
  id: string;
  reviewId: string;
  content: string;
  staffId: string;
  staffDisplayName?: string;
  deletedAt?: Date;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewHelpfulVoteRecord {
  id: string;
  reviewId: string;
  customerId: string;
  createdAt: Date;
}

export interface ReviewReportRecord {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReviewReportReason;
  description?: string;
  status: ReviewReportStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewModerationHistoryRecord {
  id: string;
  reviewId: string;
  fromStatus?: ReviewStatus;
  toStatus: ReviewStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface ReviewRecord {
  id: string;
  productId: string;
  skuId?: string;
  skuCode?: string;
  orderId: string;
  orderItemId: string;
  customerId: string;
  displayName: string;
  rating: number;
  title?: string;
  content: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  reportCount: number;
  hasMedia: boolean;
  version: number;
  activeKey: string;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  media: ReviewMediaRecord[];
  replies: ReviewReplyRecord[];
  moderationHistory: ReviewModerationHistoryRecord[];
}

export interface ProductRatingAggregateRecord {
  productId: string;
  sumRating: number;
  totalReviews: number;
  verifiedReviews: number;
  mediaReviews: number;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
  version: number;
  updatedAt: Date;
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

export interface CreateReviewInput {
  productId: string;
  skuId?: string;
  skuCode?: string;
  orderId: string;
  orderItemId: string;
  customerId: string;
  displayName: string;
  rating: number;
  title?: string;
  content: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  activeKey: string;
  media?: Array<{ mediaId: string; kind: ReviewMediaKind; sortOrder: number }>;
  moderation?: {
    action: string;
    actorId: string;
    actorType: string;
    reason?: string;
  };
  outbox: OutboxEventInput[];
  audit?: {
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
  };
}

export interface UpdateReviewFieldsInput {
  reviewId: string;
  expectedVersion: number;
  rating?: number;
  title?: string | null;
  content?: string;
  editedAt: Date;
  aggregateDelta?: AggregateDelta;
  outbox: OutboxEventInput[];
  audit?: {
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
  };
}

export interface AggregateDelta {
  productId: string;
  /** Apply remove of old published contribution then add new, or single add/remove */
  remove?: { rating: number; verified: boolean; hasMedia: boolean };
  add?: { rating: number; verified: boolean; hasMedia: boolean };
}

export interface TransitionReviewInput {
  reviewId: string;
  expectedVersion?: number;
  fromStatus: ReviewStatus;
  toStatus: ReviewStatus;
  action: string;
  actorId: string;
  actorType: string;
  reason?: string;
  rotateActiveKey?: string;
  aggregateDelta?: AggregateDelta;
  outbox: OutboxEventInput[];
  audit?: {
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
  };
}

export interface ListReviewsFilter {
  productId?: string;
  status?: ReviewStatus | ReviewStatus[];
  rating?: number;
  hasMedia?: boolean;
  verifiedOnly?: boolean;
  customerId?: string;
  reported?: boolean;
  from?: Date;
  to?: Date;
  sort:
    | 'newest'
    | 'oldest'
    | 'highest'
    | 'lowest'
    | 'most_helpful'
    | 'most_reported';
  page: number;
  pageSize: number;
}

export interface ListReviewsResult {
  items: ReviewRecord[];
  totalItems: number;
}

export interface ListReportsFilter {
  status?: ReviewReportStatus;
  reviewId?: string;
  sort: 'newest' | 'oldest';
  page: number;
  pageSize: number;
}

export interface ListReportsResult {
  items: ReviewReportRecord[];
  totalItems: number;
}
