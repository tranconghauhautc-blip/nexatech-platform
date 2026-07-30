import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  applyAggregateContribution,
  emptyAggregate,
  rebuildFromPublished,
} from './aggregate';
import type {
  CreateReviewInput,
  IdempotencyRecord,
  ListReportsFilter,
  ListReportsResult,
  ListReviewsFilter,
  ListReviewsResult,
  OutboxEventInput,
  OutboxEventRecord,
  ProductRatingAggregateRecord,
  ReviewRecord,
  ReviewReportRecord,
  ReviewReplyRecord,
  ReviewMediaRecord,
  TransitionReviewInput,
  UpdateReviewFieldsInput,
} from './review.types';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewRepository {
  createReview(input: CreateReviewInput): Promise<ReviewRecord>;
  findReviewById(id: string): Promise<ReviewRecord | null>;
  findActiveByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReviewRecord | null>;
  updateReviewFields(input: UpdateReviewFieldsInput): Promise<ReviewRecord>;
  transitionReview(input: TransitionReviewInput): Promise<ReviewRecord>;
  listReviews(filter: ListReviewsFilter): Promise<ListReviewsResult>;
  getAggregate(productId: string): Promise<ProductRatingAggregateRecord | null>;
  rebuildAggregate(productId: string): Promise<ProductRatingAggregateRecord>;
  rebuildAllAggregates(): Promise<number>;
  attachMedia(
    reviewId: string,
    mediaId: string,
    kind: ReviewMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord>;
  unlinkMedia(
    reviewId: string,
    mediaRowId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord>;
  createReply(
    reviewId: string,
    content: string,
    staffId: string,
    staffDisplayName: string | undefined,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord>;
  updateReply(
    reviewId: string,
    replyId: string,
    content: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord>;
  softDeleteReply(
    reviewId: string,
    replyId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord>;
  addHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord>;
  removeHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord>;
  createReport(
    input: {
      reviewId: string;
      reporterId: string;
      reason: ReviewReportRecord['reason'];
      description?: string;
    },
    outbox: OutboxEventInput[],
  ): Promise<ReviewReportRecord>;
  findReportById(id: string): Promise<ReviewReportRecord | null>;
  listReports(filter: ListReportsFilter): Promise<ListReportsResult>;
  resolveReport(
    reportId: string,
    resolution: 'RESOLVED' | 'DISMISSED',
    note: string,
    resolvedBy: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReportRecord>;
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

function cloneReview(r: ReviewRecord): ReviewRecord {
  return {
    ...r,
    editedAt: r.editedAt ? new Date(r.editedAt) : undefined,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    media: r.media.map((m) => ({
      ...m,
      unlinkedAt: m.unlinkedAt ? new Date(m.unlinkedAt) : undefined,
      createdAt: new Date(m.createdAt),
    })),
    replies: r.replies.map((x) => ({
      ...x,
      deletedAt: x.deletedAt ? new Date(x.deletedAt) : undefined,
      editedAt: x.editedAt ? new Date(x.editedAt) : undefined,
      createdAt: new Date(x.createdAt),
      updatedAt: new Date(x.updatedAt),
    })),
    moderationHistory: r.moderationHistory.map((h) => ({
      ...h,
      createdAt: new Date(h.createdAt),
    })),
  };
}

function applyDelta(
  store: Map<string, ProductRatingAggregateRecord>,
  productId: string,
  delta: NonNullable<UpdateReviewFieldsInput['aggregateDelta']>,
): void {
  let agg = store.get(productId) ?? emptyAggregate(productId);
  if (delta.remove) {
    agg = applyAggregateContribution(agg, delta.remove, -1);
  }
  if (delta.add) {
    agg = applyAggregateContribution(agg, delta.add, 1);
  }
  store.set(productId, agg);
}

export class InMemoryReviewRepository implements ReviewRepository {
  private reviews = new Map<string, ReviewRecord>();
  private aggregates = new Map<string, ProductRatingAggregateRecord>();
  private reports = new Map<string, ReviewReportRecord>();
  private votes = new Map<
    string,
    { id: string; reviewId: string; customerId: string; createdAt: Date }
  >();
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
    this.reviews.clear();
    this.aggregates.clear();
    this.reports.clear();
    this.votes.clear();
    this.idempotency.clear();
    this.outbox = [];
    this.audits = [];
  }

  async createReview(input: CreateReviewInput): Promise<ReviewRecord> {
    const existing = [...this.reviews.values()].find(
      (r) =>
        r.customerId === input.customerId &&
        r.orderItemId === input.orderItemId &&
        r.status !== 'DELETED',
    );
    if (existing) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
        message: 'Bạn đã đánh giá mục đơn hàng này',
        details: { orderItemId: input.orderItemId },
      });
    }
    const now = new Date();
    const id = createId();
    const media: ReviewMediaRecord[] = (input.media ?? []).map((m, idx) => ({
      id: createId(),
      reviewId: id,
      mediaId: m.mediaId,
      kind: m.kind,
      sortOrder: m.sortOrder ?? idx,
      createdAt: now,
    }));
    const history: ReviewRecord['moderationHistory'] = [
      {
        id: createId(),
        reviewId: id,
        toStatus: input.status,
        action: input.moderation?.action ?? 'create',
        actorId: input.moderation?.actorId ?? input.customerId,
        actorType: input.moderation?.actorType ?? 'customer',
        reason: input.moderation?.reason,
        createdAt: now,
      },
    ];
    const review: ReviewRecord = {
      id,
      productId: input.productId,
      skuId: input.skuId,
      skuCode: input.skuCode,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      customerId: input.customerId,
      displayName: input.displayName,
      rating: input.rating,
      title: input.title,
      content: input.content,
      verifiedPurchase: input.verifiedPurchase,
      status: input.status,
      helpfulCount: 0,
      reportCount: 0,
      hasMedia: media.length > 0,
      version: 0,
      activeKey: input.activeKey,
      createdAt: now,
      updatedAt: now,
      media,
      replies: [],
      moderationHistory: history,
    };
    this.reviews.set(id, review);
    if (input.status === 'PUBLISHED') {
      applyDelta(this.aggregates, input.productId, {
        productId: input.productId,
        add: {
          rating: input.rating,
          verified: input.verifiedPurchase,
          hasMedia: review.hasMedia,
        },
      });
    }
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneReview(review);
  }

  async findReviewById(id: string): Promise<ReviewRecord | null> {
    const r = this.reviews.get(id);
    return r ? cloneReview(r) : null;
  }

  async findActiveByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReviewRecord | null> {
    const found = [...this.reviews.values()].find(
      (r) =>
        r.customerId === customerId &&
        r.orderItemId === orderItemId &&
        r.status !== 'DELETED',
    );
    return found ? cloneReview(found) : null;
  }

  async updateReviewFields(
    input: UpdateReviewFieldsInput,
  ): Promise<ReviewRecord> {
    const review = this.reviews.get(input.reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (review.version !== input.expectedVersion) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_CONFLICT,
        message: 'Đánh giá đã được cập nhật bởi thao tác khác',
        details: {
          expectedVersion: input.expectedVersion,
          actualVersion: review.version,
        },
      });
    }
    if (input.rating !== undefined) {
      review.rating = input.rating;
    }
    if (input.title !== undefined) {
      review.title = input.title ?? undefined;
    }
    if (input.content !== undefined) {
      review.content = input.content;
    }
    review.editedAt = input.editedAt;
    review.updatedAt = new Date();
    review.version += 1;
    if (input.aggregateDelta) {
      applyDelta(this.aggregates, review.productId, input.aggregateDelta);
    }
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneReview(review);
  }

  async transitionReview(input: TransitionReviewInput): Promise<ReviewRecord> {
    const review = this.reviews.get(input.reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      review.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_CONFLICT,
        message: 'Đánh giá đã được cập nhật bởi thao tác khác',
      });
    }
    if (review.status !== input.fromStatus) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
        message: 'Trạng thái đánh giá không khớp',
        details: { expected: input.fromStatus, actual: review.status },
      });
    }
    const fromStatus = review.status;
    review.status = input.toStatus;
    review.version += 1;
    review.updatedAt = new Date();
    if (input.rotateActiveKey) {
      review.activeKey = input.rotateActiveKey;
    }
    if (input.toStatus === 'DELETED') {
      for (const m of review.media) {
        if (!m.unlinkedAt) {
          m.unlinkedAt = new Date();
        }
      }
      review.hasMedia = false;
    }
    review.moderationHistory.push({
      id: createId(),
      reviewId: review.id,
      fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: new Date(),
    });
    if (input.aggregateDelta) {
      applyDelta(this.aggregates, review.productId, input.aggregateDelta);
    }
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneReview(review);
  }

  async listReviews(filter: ListReviewsFilter): Promise<ListReviewsResult> {
    let items = [...this.reviews.values()];
    if (filter.productId) {
      items = items.filter((r) => r.productId === filter.productId);
    }
    if (filter.status) {
      const statuses = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      items = items.filter((r) => statuses.includes(r.status));
    }
    if (filter.rating !== undefined) {
      items = items.filter((r) => r.rating === filter.rating);
    }
    if (filter.hasMedia !== undefined) {
      items = items.filter((r) => r.hasMedia === filter.hasMedia);
    }
    if (filter.verifiedOnly) {
      items = items.filter((r) => r.verifiedPurchase);
    }
    if (filter.customerId) {
      items = items.filter((r) => r.customerId === filter.customerId);
    }
    if (filter.reported) {
      items = items.filter((r) => r.reportCount > 0);
    }
    if (filter.from) {
      const from = filter.from;
      items = items.filter((r) => r.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((r) => r.createdAt <= to);
    }
    switch (filter.sort) {
      case 'highest':
        items.sort(
          (a, b) =>
            b.rating - a.rating ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        );
        break;
      case 'lowest':
        items.sort(
          (a, b) =>
            a.rating - b.rating ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        );
        break;
      case 'most_helpful':
        items.sort(
          (a, b) =>
            b.helpfulCount - a.helpfulCount ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        );
        break;
      case 'most_reported':
        items.sort(
          (a, b) =>
            b.reportCount - a.reportCount ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        );
        break;
      case 'oldest':
        items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'newest':
      default:
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const pageItems = items
      .slice(start, start + filter.pageSize)
      .map(cloneReview);
    return { items: pageItems, totalItems };
  }

  async getAggregate(
    productId: string,
  ): Promise<ProductRatingAggregateRecord | null> {
    const agg = this.aggregates.get(productId);
    return agg ? { ...agg, updatedAt: new Date(agg.updatedAt) } : null;
  }

  async rebuildAggregate(
    productId: string,
  ): Promise<ProductRatingAggregateRecord> {
    const published = [...this.reviews.values()].filter(
      (r) => r.productId === productId && r.status === 'PUBLISHED',
    );
    const agg = rebuildFromPublished(
      productId,
      published.map((r) => ({
        rating: r.rating,
        verifiedPurchase: r.verifiedPurchase,
        hasMedia: r.hasMedia,
      })),
    );
    this.aggregates.set(productId, agg);
    return { ...agg };
  }

  async rebuildAllAggregates(): Promise<number> {
    const productIds = [
      ...new Set([...this.reviews.values()].map((r) => r.productId)),
    ];
    for (const productId of productIds) {
      await this.rebuildAggregate(productId);
    }
    return productIds.length;
  }

  async attachMedia(
    reviewId: string,
    mediaId: string,
    kind: ReviewMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (review.media.some((m) => m.mediaId === mediaId && !m.unlinkedAt)) {
      return cloneReview(review);
    }
    const active = review.media.filter((m) => !m.unlinkedAt);
    const images = active.filter((m) => m.kind === 'IMAGE').length;
    const videos = active.filter((m) => m.kind === 'VIDEO').length;
    if (kind === 'IMAGE' && images >= 5) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_MEDIA_LIMIT,
        message: 'Tối đa 5 ảnh trên một đánh giá',
      });
    }
    if (kind === 'VIDEO' && videos >= 1) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_MEDIA_LIMIT,
        message: 'Tối đa 1 video trên một đánh giá',
      });
    }
    const wasPublished = review.status === 'PUBLISHED';
    const hadMedia = review.hasMedia;
    review.media.push({
      id: createId(),
      reviewId,
      mediaId,
      kind,
      sortOrder: active.length,
      createdAt: new Date(),
    });
    review.hasMedia = true;
    review.version += 1;
    review.updatedAt = new Date();
    if (wasPublished && !hadMedia) {
      applyDelta(this.aggregates, review.productId, {
        productId: review.productId,
        remove: {
          rating: review.rating,
          verified: review.verifiedPurchase,
          hasMedia: false,
        },
        add: {
          rating: review.rating,
          verified: review.verifiedPurchase,
          hasMedia: true,
        },
      });
    }
    await this.addOutbox(outbox);
    return cloneReview(review);
  }

  async unlinkMedia(
    reviewId: string,
    mediaRowId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const media = review.media.find((m) => m.id === mediaRowId);
    if (!media || media.unlinkedAt) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media của đánh giá',
      });
    }
    const wasPublished = review.status === 'PUBLISHED';
    const hadMedia = review.hasMedia;
    media.unlinkedAt = new Date();
    review.hasMedia = review.media.some((m) => !m.unlinkedAt);
    review.version += 1;
    review.updatedAt = new Date();
    if (wasPublished && hadMedia !== review.hasMedia) {
      applyDelta(this.aggregates, review.productId, {
        productId: review.productId,
        remove: {
          rating: review.rating,
          verified: review.verifiedPurchase,
          hasMedia: hadMedia,
        },
        add: {
          rating: review.rating,
          verified: review.verifiedPurchase,
          hasMedia: review.hasMedia,
        },
      });
    }
    await this.addOutbox(outbox);
    return cloneReview(review);
  }

  async createReply(
    reviewId: string,
    content: string,
    staffId: string,
    staffDisplayName: string | undefined,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (review.replies.some((r) => !r.deletedAt)) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_REPLY_EXISTS,
        message: 'Đánh giá đã có phản hồi cửa hàng',
      });
    }
    const now = new Date();
    const reply: ReviewReplyRecord = {
      id: createId(),
      reviewId,
      content,
      staffId,
      staffDisplayName,
      createdAt: now,
      updatedAt: now,
    };
    review.replies.push(reply);
    review.updatedAt = now;
    await this.addOutbox(outbox);
    return { ...reply };
  }

  async updateReply(
    reviewId: string,
    replyId: string,
    content: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const reply = review.replies.find((r) => r.id === replyId && !r.deletedAt);
    if (!reply) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_REPLY_NOT_FOUND,
        message: 'Không tìm thấy phản hồi',
      });
    }
    reply.content = content;
    reply.editedAt = new Date();
    reply.updatedAt = new Date();
    await this.addOutbox(outbox);
    return { ...reply };
  }

  async softDeleteReply(
    reviewId: string,
    replyId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const reply = review.replies.find((r) => r.id === replyId && !r.deletedAt);
    if (!reply) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_REPLY_NOT_FOUND,
        message: 'Không tìm thấy phản hồi',
      });
    }
    reply.deletedAt = new Date();
    reply.updatedAt = new Date();
    await this.addOutbox(outbox);
    return { ...reply };
  }

  async addHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const key = `${reviewId}:${customerId}`;
    if (this.votes.has(key)) {
      return cloneReview(review);
    }
    this.votes.set(key, {
      id: createId(),
      reviewId,
      customerId,
      createdAt: new Date(),
    });
    review.helpfulCount += 1;
    review.updatedAt = new Date();
    await this.addOutbox(outbox);
    return cloneReview(review);
  }

  async removeHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const key = `${reviewId}:${customerId}`;
    if (!this.votes.has(key)) {
      return cloneReview(review);
    }
    this.votes.delete(key);
    review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    review.updatedAt = new Date();
    await this.addOutbox(outbox);
    return cloneReview(review);
  }

  async createReport(
    input: {
      reviewId: string;
      reporterId: string;
      reason: ReviewReportRecord['reason'];
      description?: string;
    },
    outbox: OutboxEventInput[],
  ): Promise<ReviewReportRecord> {
    const review = this.reviews.get(input.reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const dup = [...this.reports.values()].find(
      (r) =>
        r.reviewId === input.reviewId &&
        r.reporterId === input.reporterId &&
        r.reason === input.reason &&
        (r.status === 'OPEN' || r.status === 'REVIEWING'),
    );
    if (dup) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_REPORT_DUPLICATE,
        message: 'Bạn đã báo cáo đánh giá này với lý do tương tự',
      });
    }
    const now = new Date();
    const report: ReviewReportRecord = {
      id: createId(),
      reviewId: input.reviewId,
      reporterId: input.reporterId,
      reason: input.reason,
      description: input.description,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };
    this.reports.set(report.id, report);
    review.reportCount += 1;
    review.updatedAt = now;
    await this.addOutbox(outbox);
    return { ...report };
  }

  async findReportById(id: string): Promise<ReviewReportRecord | null> {
    const r = this.reports.get(id);
    return r ? { ...r } : null;
  }

  async listReports(filter: ListReportsFilter): Promise<ListReportsResult> {
    let items = [...this.reports.values()];
    if (filter.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter.reviewId) {
      items = items.filter((r) => r.reviewId === filter.reviewId);
    }
    items.sort((a, b) =>
      filter.sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map((r) => ({ ...r })),
      totalItems,
    };
  }

  async resolveReport(
    reportId: string,
    resolution: 'RESOLVED' | 'DISMISSED',
    note: string,
    resolvedBy: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReportRecord> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_REPORT_NOT_FOUND,
        message: 'Không tìm thấy báo cáo',
      });
    }
    report.status = resolution;
    report.resolutionNote = note;
    report.resolvedBy = resolvedBy;
    report.resolvedAt = new Date();
    report.updatedAt = new Date();
    await this.addOutbox(outbox);
    return { ...report };
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
        errorCode: ErrorCodes.REVIEW_IDEMPOTENCY_CONFLICT,
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
