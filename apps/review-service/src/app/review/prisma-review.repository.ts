import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import {
  applyAggregateContribution,
  emptyAggregate,
  rebuildFromPublished,
} from './aggregate';
import { PrismaService } from './prisma.service';
import type { ReviewRepository } from './review.repository';
import type {
  AggregateDelta,
  CreateReviewInput,
  IdempotencyRecord,
  ListReportsFilter,
  ListReportsResult,
  ListReviewsFilter,
  ListReviewsResult,
  OutboxEventInput,
  OutboxEventRecord,
  ProductRatingAggregateRecord,
  ReviewMediaRecord,
  ReviewModerationHistoryRecord,
  ReviewRecord,
  ReviewReplyRecord,
  ReviewReportRecord,
  TransitionReviewInput,
  UpdateReviewFieldsInput,
} from './review.types';

const REVIEW_INCLUDE = {
  media: true,
  replies: true,
  moderationHistory: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ReviewInclude;

type PrismaReviewFull = Prisma.ReviewGetPayload<{
  include: typeof REVIEW_INCLUDE;
}>;

type DbClient = PrismaService | Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

function mapMedia(row: PrismaReviewFull['media'][number]): ReviewMediaRecord {
  return {
    id: row.id,
    reviewId: row.reviewId,
    mediaId: row.mediaId,
    kind: row.kind,
    sortOrder: row.sortOrder,
    unlinkedAt: row.deletedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapReply(row: PrismaReviewFull['replies'][number]): ReviewReplyRecord {
  return {
    id: row.id,
    reviewId: row.reviewId,
    content: row.content,
    staffId: row.staffId,
    staffDisplayName: row.staffDisplayName ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
    editedAt: row.editedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapModerationHistory(
  row: PrismaReviewFull['moderationHistory'][number],
): ReviewModerationHistoryRecord {
  return {
    id: row.id,
    reviewId: row.reviewId,
    fromStatus: row.fromStatus ?? undefined,
    toStatus: row.toStatus,
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  };
}

function computeHasMedia(media: PrismaReviewFull['media']): boolean {
  return media.some((m) => !m.deletedAt);
}

function mapReview(row: PrismaReviewFull): ReviewRecord {
  return {
    id: row.id,
    productId: row.productId,
    skuId: row.skuId ?? undefined,
    skuCode: row.skuCode ?? undefined,
    orderId: row.orderId,
    orderItemId: row.orderItemId,
    customerId: row.customerId,
    displayName: row.displayName,
    rating: row.rating,
    title: row.title ?? undefined,
    content: row.content,
    verifiedPurchase: row.verifiedPurchase,
    status: row.status,
    helpfulCount: row.helpfulCount,
    reportCount: row.reportCount,
    hasMedia: computeHasMedia(row.media),
    version: row.version,
    activeKey: row.activeKey,
    editedAt: row.editedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    media: row.media.map(mapMedia),
    replies: row.replies.map(mapReply),
    moderationHistory: row.moderationHistory.map(mapModerationHistory),
  };
}

function mapAggregate(
  row: Prisma.ProductRatingAggregateGetPayload<object>,
): ProductRatingAggregateRecord {
  return {
    productId: row.productId,
    sumRating: row.sumRating,
    totalReviews: row.totalReviews,
    verifiedReviews: row.verifiedReviews,
    mediaReviews: row.mediaReviews,
    star1: row.star1,
    star2: row.star2,
    star3: row.star3,
    star4: row.star4,
    star5: row.star5,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function mapReport(
  row: Prisma.ReviewReportGetPayload<object>,
): ReviewReportRecord {
  return {
    id: row.id,
    reviewId: row.reviewId,
    reporterId: row.reporterId,
    reason: row.reason,
    description: row.description ?? undefined,
    status: row.status,
    resolutionNote: row.resolutionNote ?? undefined,
    resolvedBy: row.resolvedBy ?? undefined,
    resolvedAt: row.resolvedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function aggregateUpsertData(agg: ProductRatingAggregateRecord) {
  return {
    sumRating: agg.sumRating,
    totalReviews: agg.totalReviews,
    verifiedReviews: agg.verifiedReviews,
    mediaReviews: agg.mediaReviews,
    star1: agg.star1,
    star2: agg.star2,
    star3: agg.star3,
    star4: agg.star4,
    star5: agg.star5,
    version: agg.version,
    updatedAt: agg.updatedAt,
  };
}

async function applyDeltaInTx(
  tx: Prisma.TransactionClient,
  delta: AggregateDelta,
): Promise<void> {
  const { productId } = delta;
  const row = await tx.productRatingAggregate.findUnique({
    where: { productId },
  });
  let agg = row ? mapAggregate(row) : emptyAggregate(productId);
  if (delta.remove) {
    agg = applyAggregateContribution(agg, delta.remove, -1);
  }
  if (delta.add) {
    agg = applyAggregateContribution(agg, delta.add, 1);
  }
  await tx.productRatingAggregate.upsert({
    where: { productId },
    create: {
      productId: agg.productId,
      ...aggregateUpsertData(agg),
    },
    update: aggregateUpsertData(agg),
  });
}

async function insertOutbox(
  tx: Prisma.TransactionClient,
  events: OutboxEventInput[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  await tx.outboxEvent.createMany({
    data: events.map((event) => ({
      id: createId(),
      eventType: event.eventType,
      routingKey: event.routingKey,
      payloadJson: event.payload as Prisma.InputJsonValue,
      traceId: event.traceId,
    })),
  });
}

async function insertAudit(
  tx: Prisma.TransactionClient,
  action: string,
  actorId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      id: createId(),
      action,
      actorId,
      details: details as Prisma.InputJsonValue | undefined,
    },
  });
}

async function loadReview(
  client: DbClient,
  id: string,
): Promise<PrismaReviewFull | null> {
  return client.review.findUnique({
    where: { id },
    include: REVIEW_INCLUDE,
  });
}

async function loadReviewOrThrow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<PrismaReviewFull> {
  const row = await loadReview(tx, id);
  if (!row) {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_NOT_FOUND,
      message: 'Không tìm thấy đánh giá',
    });
  }
  return row;
}

function buildListReviewsWhere(
  filter: ListReviewsFilter,
): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = {};
  if (filter.productId) {
    where.productId = filter.productId;
  }
  if (filter.status) {
    where.status = Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status;
  }
  if (filter.rating !== undefined) {
    where.rating = filter.rating;
  }
  if (filter.hasMedia === true) {
    where.media = { some: { deletedAt: null } };
  } else if (filter.hasMedia === false) {
    where.NOT = { media: { some: { deletedAt: null } } };
  }
  if (filter.verifiedOnly) {
    where.verifiedPurchase = true;
  }
  if (filter.customerId) {
    where.customerId = filter.customerId;
  }
  if (filter.reported) {
    where.reportCount = { gt: 0 };
  }
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) {
      where.createdAt.gte = filter.from;
    }
    if (filter.to) {
      where.createdAt.lte = filter.to;
    }
  }
  return where;
}

function listReviewsOrderBy(
  sort: ListReviewsFilter['sort'],
): Prisma.ReviewOrderByWithRelationInput[] {
  switch (sort) {
    case 'highest':
      return [{ rating: 'desc' }, { createdAt: 'desc' }];
    case 'lowest':
      return [{ rating: 'asc' }, { createdAt: 'desc' }];
    case 'most_helpful':
      return [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
    case 'most_reported':
      return [{ reportCount: 'desc' }, { createdAt: 'desc' }];
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(input: CreateReviewInput): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const byActiveKey = await tx.review.findUnique({
        where: { activeKey: input.activeKey },
      });
      if (byActiveKey && byActiveKey.status !== 'DELETED') {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
          message: 'Bạn đã đánh giá mục đơn hàng này',
          details: { orderItemId: input.orderItemId },
        });
      }

      const existing = await tx.review.findFirst({
        where: {
          customerId: input.customerId,
          orderItemId: input.orderItemId,
          status: { not: 'DELETED' },
        },
      });
      if (existing) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
          message: 'Bạn đã đánh giá mục đơn hàng này',
          details: { orderItemId: input.orderItemId },
        });
      }

      const id = createId();
      const mediaRows = (input.media ?? []).map((m, idx) => ({
        id: createId(),
        mediaId: m.mediaId,
        kind: m.kind,
        sortOrder: m.sortOrder ?? idx,
      }));
      const hasMedia = mediaRows.length > 0;

      try {
        await tx.review.create({
          data: {
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
            activeKey: input.activeKey,
            media: {
              create: mediaRows,
            },
            moderationHistory: {
              create: {
                id: createId(),
                toStatus: input.status,
                action: input.moderation?.action ?? 'create',
                actorId: input.moderation?.actorId ?? input.customerId,
                actorType: input.moderation?.actorType ?? 'customer',
                reason: input.moderation?.reason,
              },
            },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
            message: 'Bạn đã đánh giá mục đơn hàng này',
            details: { orderItemId: input.orderItemId },
          });
        }
        throw error;
      }

      if (input.status === 'PUBLISHED') {
        await applyDeltaInTx(tx, {
          productId: input.productId,
          add: {
            rating: input.rating,
            verified: input.verifiedPurchase,
            hasMedia,
          },
        });
      }

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadReviewOrThrow(tx, id);
      return mapReview(row);
    });
  }

  async findReviewById(id: string): Promise<ReviewRecord | null> {
    const row = await loadReview(this.prisma, id);
    return row ? mapReview(row) : null;
  }

  async findActiveByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReviewRecord | null> {
    const row = await this.prisma.review.findFirst({
      where: {
        customerId,
        orderItemId,
        status: { not: 'DELETED' },
      },
      include: REVIEW_INCLUDE,
    });
    return row ? mapReview(row) : null;
  }

  async updateReviewFields(
    input: UpdateReviewFieldsInput,
  ): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReviewOrThrow(tx, input.reviewId);
      if (current.version !== input.expectedVersion) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_CONFLICT,
          message: 'Đánh giá đã được cập nhật bởi thao tác khác',
          details: {
            expectedVersion: input.expectedVersion,
            actualVersion: current.version,
          },
        });
      }

      const updated = await tx.review.updateMany({
        where: {
          id: input.reviewId,
          version: input.expectedVersion,
        },
        data: {
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.title !== undefined ? { title: input.title ?? null } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          editedAt: input.editedAt,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_CONFLICT,
          message: 'Đánh giá đã được cập nhật bởi thao tác khác',
          details: {
            expectedVersion: input.expectedVersion,
            actualVersion: current.version,
          },
        });
      }

      if (input.aggregateDelta) {
        await applyDeltaInTx(tx, input.aggregateDelta);
      }

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadReviewOrThrow(tx, input.reviewId);
      return mapReview(row);
    });
  }

  async transitionReview(input: TransitionReviewInput): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReviewOrThrow(tx, input.reviewId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_CONFLICT,
          message: 'Đánh giá đã được cập nhật bởi thao tác khác',
        });
      }
      if (current.status !== input.fromStatus) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
          message: 'Trạng thái đánh giá không khớp',
          details: { expected: input.fromStatus, actual: current.status },
        });
      }

      const where: Prisma.ReviewWhereInput = {
        id: input.reviewId,
        status: input.fromStatus,
      };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.review.updateMany({
        where,
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
          ...(input.rotateActiveKey
            ? { activeKey: input.rotateActiveKey }
            : {}),
          ...(input.toStatus === 'DELETED' ? { deletedAt: new Date() } : {}),
        },
      });
      if (updated.count !== 1) {
        if (input.expectedVersion !== undefined) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_CONFLICT,
            message: 'Đánh giá đã được cập nhật bởi thao tác khác',
          });
        }
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
          message: 'Trạng thái đánh giá không khớp',
          details: { expected: input.fromStatus, actual: current.status },
        });
      }

      if (input.toStatus === 'DELETED') {
        await tx.reviewMedia.updateMany({
          where: { reviewId: input.reviewId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }

      await tx.reviewModerationHistory.create({
        data: {
          id: createId(),
          reviewId: input.reviewId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          action: input.action,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });

      if (input.aggregateDelta) {
        await applyDeltaInTx(tx, input.aggregateDelta);
      }

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadReviewOrThrow(tx, input.reviewId);
      return mapReview(row);
    });
  }

  async listReviews(filter: ListReviewsFilter): Promise<ListReviewsResult> {
    const where = buildListReviewsWhere(filter);
    const orderBy = listReviewsOrderBy(filter.sort);
    const skip = (filter.page - 1) * filter.pageSize;

    const [rows, totalItems] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: filter.pageSize,
        include: REVIEW_INCLUDE,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: rows.map(mapReview),
      totalItems,
    };
  }

  async getAggregate(
    productId: string,
  ): Promise<ProductRatingAggregateRecord | null> {
    const row = await this.prisma.productRatingAggregate.findUnique({
      where: { productId },
    });
    return row ? mapAggregate(row) : null;
  }

  async rebuildAggregate(
    productId: string,
  ): Promise<ProductRatingAggregateRecord> {
    return this.prisma.$transaction(async (tx) => {
      const published = await tx.review.findMany({
        where: { productId, status: 'PUBLISHED' },
        include: { media: true },
      });
      const agg = rebuildFromPublished(
        productId,
        published.map((r) => ({
          rating: r.rating,
          verifiedPurchase: r.verifiedPurchase,
          hasMedia: r.media.some((m) => !m.deletedAt),
        })),
      );
      await tx.productRatingAggregate.upsert({
        where: { productId },
        create: {
          productId: agg.productId,
          ...aggregateUpsertData(agg),
        },
        update: aggregateUpsertData(agg),
      });
      return agg;
    });
  }

  async rebuildAllAggregates(): Promise<number> {
    const productIds = await this.prisma.review.findMany({
      select: { productId: true },
      distinct: ['productId'],
    });
    for (const { productId } of productIds) {
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
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReviewOrThrow(tx, reviewId);
      const review = mapReview(current);

      if (review.media.some((m) => m.mediaId === mediaId && !m.unlinkedAt)) {
        return review;
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

      await tx.reviewMedia.create({
        data: {
          id: createId(),
          reviewId,
          mediaId,
          kind,
          sortOrder: active.length,
        },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (wasPublished && !hadMedia) {
        await applyDeltaInTx(tx, {
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

      await insertOutbox(tx, outbox);

      const row = await loadReviewOrThrow(tx, reviewId);
      return mapReview(row);
    });
  }

  async unlinkMedia(
    reviewId: string,
    mediaRowId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReviewOrThrow(tx, reviewId);
      const review = mapReview(current);
      const media = review.media.find((m) => m.id === mediaRowId);
      if (!media || media.unlinkedAt) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_MEDIA_NOT_FOUND,
          message: 'Không tìm thấy media của đánh giá',
        });
      }

      const wasPublished = review.status === 'PUBLISHED';
      const hadMedia = review.hasMedia;

      await tx.reviewMedia.update({
        where: { id: mediaRowId },
        data: { deletedAt: new Date() },
      });

      const remaining = await tx.reviewMedia.count({
        where: { reviewId, deletedAt: null },
      });
      const hasMedia = remaining > 0;

      await tx.review.update({
        where: { id: reviewId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (wasPublished && hadMedia !== hasMedia) {
        await applyDeltaInTx(tx, {
          productId: review.productId,
          remove: {
            rating: review.rating,
            verified: review.verifiedPurchase,
            hasMedia: hadMedia,
          },
          add: {
            rating: review.rating,
            verified: review.verifiedPurchase,
            hasMedia,
          },
        });
      }

      await insertOutbox(tx, outbox);

      const row = await loadReviewOrThrow(tx, reviewId);
      return mapReview(row);
    });
  }

  async createReply(
    reviewId: string,
    content: string,
    staffId: string,
    staffDisplayName: string | undefined,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, reviewId);

      const activeReply = await tx.reviewReply.findFirst({
        where: { reviewId, deletedAt: null },
      });
      if (activeReply) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_REPLY_EXISTS,
          message: 'Đánh giá đã có phản hồi cửa hàng',
        });
      }

      const now = new Date();
      const id = createId();
      const reply = await tx.reviewReply.create({
        data: {
          id,
          reviewId,
          activeKey: `review:${reviewId}`,
          content,
          staffId,
          staffDisplayName,
        },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { updatedAt: now },
      });

      await insertOutbox(tx, outbox);

      return {
        id: reply.id,
        reviewId: reply.reviewId,
        content: reply.content,
        staffId: reply.staffId,
        staffDisplayName: reply.staffDisplayName ?? undefined,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });
  }

  async updateReply(
    reviewId: string,
    replyId: string,
    content: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, reviewId);

      const existing = await tx.reviewReply.findFirst({
        where: { id: replyId, reviewId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_REPLY_NOT_FOUND,
          message: 'Không tìm thấy phản hồi',
        });
      }

      const now = new Date();
      const reply = await tx.reviewReply.update({
        where: { id: replyId },
        data: {
          content,
          editedAt: now,
          updatedAt: now,
        },
      });

      await insertOutbox(tx, outbox);

      return {
        id: reply.id,
        reviewId: reply.reviewId,
        content: reply.content,
        staffId: reply.staffId,
        staffDisplayName: reply.staffDisplayName ?? undefined,
        editedAt: reply.editedAt ?? undefined,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });
  }

  async softDeleteReply(
    reviewId: string,
    replyId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewReplyRecord> {
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, reviewId);

      const existing = await tx.reviewReply.findFirst({
        where: { id: replyId, reviewId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_REPLY_NOT_FOUND,
          message: 'Không tìm thấy phản hồi',
        });
      }

      const now = new Date();
      const reply = await tx.reviewReply.update({
        where: { id: replyId },
        data: {
          deletedAt: now,
          activeKey: `deleted:${createId()}`,
          updatedAt: now,
        },
      });

      await insertOutbox(tx, outbox);

      return {
        id: reply.id,
        reviewId: reply.reviewId,
        content: reply.content,
        staffId: reply.staffId,
        staffDisplayName: reply.staffDisplayName ?? undefined,
        deletedAt: reply.deletedAt ?? undefined,
        editedAt: reply.editedAt ?? undefined,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });
  }

  async addHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, reviewId);

      const existing = await tx.reviewHelpfulVote.findUnique({
        where: {
          reviewId_customerId: { reviewId, customerId },
        },
      });
      if (existing) {
        const row = await loadReviewOrThrow(tx, reviewId);
        return mapReview(row);
      }

      await tx.reviewHelpfulVote.create({
        data: {
          id: createId(),
          reviewId,
          customerId,
        },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: {
          helpfulCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      await insertOutbox(tx, outbox);

      const row = await loadReviewOrThrow(tx, reviewId);
      return mapReview(row);
    });
  }

  async removeHelpfulVote(
    reviewId: string,
    customerId: string,
    outbox: OutboxEventInput[],
  ): Promise<ReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, reviewId);

      const existing = await tx.reviewHelpfulVote.findUnique({
        where: {
          reviewId_customerId: { reviewId, customerId },
        },
      });
      if (!existing) {
        const row = await loadReviewOrThrow(tx, reviewId);
        return mapReview(row);
      }

      await tx.reviewHelpfulVote.delete({
        where: { id: existing.id },
      });

      const current = await tx.review.findUniqueOrThrow({
        where: { id: reviewId },
      });
      await tx.review.update({
        where: { id: reviewId },
        data: {
          helpfulCount: Math.max(0, current.helpfulCount - 1),
          updatedAt: new Date(),
        },
      });

      await insertOutbox(tx, outbox);

      const row = await loadReviewOrThrow(tx, reviewId);
      return mapReview(row);
    });
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
    return this.prisma.$transaction(async (tx) => {
      await loadReviewOrThrow(tx, input.reviewId);

      const activeKey = `${input.reviewId}:${input.reporterId}:${input.reason}`;
      const dup = await tx.reviewReport.findUnique({
        where: { activeKey },
      });
      if (dup && (dup.status === 'OPEN' || dup.status === 'REVIEWING')) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_REPORT_DUPLICATE,
          message: 'Bạn đã báo cáo đánh giá này với lý do tương tự',
        });
      }

      const now = new Date();
      const id = createId();
      const report = await tx.reviewReport.create({
        data: {
          id,
          reviewId: input.reviewId,
          reporterId: input.reporterId,
          reason: input.reason,
          description: input.description,
          status: 'OPEN',
          activeKey,
        },
      });

      await tx.review.update({
        where: { id: input.reviewId },
        data: {
          reportCount: { increment: 1 },
          updatedAt: now,
        },
      });

      await insertOutbox(tx, outbox);

      return mapReport(report);
    });
  }

  async findReportById(id: string): Promise<ReviewReportRecord | null> {
    const row = await this.prisma.reviewReport.findUnique({ where: { id } });
    return row ? mapReport(row) : null;
  }

  async listReports(filter: ListReportsFilter): Promise<ListReportsResult> {
    const where: Prisma.ReviewReportWhereInput = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.reviewId) {
      where.reviewId = filter.reviewId;
    }

    const orderBy: Prisma.ReviewReportOrderByWithRelationInput = {
      createdAt: filter.sort === 'oldest' ? 'asc' : 'desc',
    };
    const skip = (filter.page - 1) * filter.pageSize;

    const [rows, totalItems] = await Promise.all([
      this.prisma.reviewReport.findMany({
        where,
        orderBy,
        skip,
        take: filter.pageSize,
      }),
      this.prisma.reviewReport.count({ where }),
    ]);

    return {
      items: rows.map(mapReport),
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
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reviewReport.findUnique({
        where: { id: reportId },
      });
      if (!existing) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_REPORT_NOT_FOUND,
          message: 'Không tìm thấy báo cáo',
        });
      }

      const now = new Date();
      const report = await tx.reviewReport.update({
        where: { id: reportId },
        data: {
          status: resolution,
          resolutionNote: note,
          resolvedBy,
          resolvedAt: now,
          activeKey: `resolved:${createId()}`,
          updatedAt: now,
        },
      });

      await insertOutbox(tx, outbox);

      return mapReport(report);
    });
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.reviewIdempotency.findUnique({
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
    const existing = await this.prisma.reviewIdempotency.findUnique({
      where: { key },
    });
    if (existing) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_IDEMPOTENCY_CONFLICT,
        message: 'Idempotency key đã được sử dụng',
      });
    }
    try {
      await this.prisma.reviewIdempotency.create({
        data: {
          key,
          operation,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          errorCode: ErrorCodes.REVIEW_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã được sử dụng',
        });
      }
      throw error;
    }
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.createMany({
      data: events.map((event) => ({
        id: createId(),
        eventType: event.eventType,
        routingKey: event.routingKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
        traceId: event.traceId,
      })),
    });
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      routingKey: row.routingKey,
      payload: row.payloadJson as Record<string, unknown>,
      traceId: row.traceId,
      publishedAt: row.publishedAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
    });
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
