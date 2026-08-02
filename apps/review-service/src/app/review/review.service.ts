import { createId } from '@nexatech/shared-platform';
import {
  REVIEW_LIMITS,
  attachReviewMediaRequestSchema,
  createPaginatedResponse,
  createReviewReplyRequestSchema,
  createReviewReportRequestSchema,
  createReviewRequestSchema,
  listAdminReviewsQuerySchema,
  listProductReviewsQuerySchema,
  listReviewReportsQuerySchema,
  moderateReviewRequestSchema,
  rebuildAggregatesRequestSchema,
  resolveReviewReportRequestSchema,
  updateReviewReplyRequestSchema,
  updateReviewRequestSchema,
  type AdminReviewDetailDto,
  type ProductRatingSummaryDto,
  type ReviewDto,
  type ReviewMediaKind,
  type ReviewReplyDto,
  type ReviewReportDto,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { enforceResourceOwnership } from '@nexatech/shared-security-lab';
import {
  EventTypes,
  createEventEnvelope,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import { averageRating, averageRatingCents } from './aggregate';
import type { CatalogClient } from './catalog.client';
import type { ReviewEventPublisher } from './event-publisher';
import type { MediaClient } from './media.client';
import type { OrderClient } from './order.client';
import { maskDisplayName, sanitizeText } from './privacy';
import type { ReviewRepository } from './review.repository';
import {
  assertTransition,
  initialReviewStatus,
  resolveModerateTarget,
} from './review-state-machine';
import type {
  Actor,
  OrderSnapshot,
  OutboxEventInput,
  ReviewRecord,
  ReviewReplyRecord,
  ReviewReportRecord,
} from './review.types';

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

function autoPublishEnabled(): boolean {
  return process.env['REVIEW_AUTO_PUBLISH'] !== 'false';
}

function editWindowMs(): number {
  return REVIEW_LIMITS.EDIT_WINDOW_HOURS * 60 * 60 * 1000;
}

function kindFromMime(mimeType: string): ReviewMediaKind {
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }
  if (mimeType.startsWith('video/')) {
    return 'VIDEO';
  }
  throw new AppError({
    errorCode: ErrorCodes.REVIEW_MEDIA_INVALID,
    message: 'Media phải là ảnh hoặc video',
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

function activeReply(review: ReviewRecord): ReviewReplyRecord | undefined {
  return review.replies.find((r) => !r.deletedAt);
}

function toReplyDto(reply: ReviewReplyRecord): ReviewReplyDto {
  return {
    id: reply.id,
    content: reply.content,
    staffId: reply.staffId,
    staffDisplayName: reply.staffDisplayName,
    createdAt: reply.createdAt.toISOString(),
    updatedAt: reply.updatedAt.toISOString(),
    editedAt: reply.editedAt?.toISOString(),
  };
}

function toReviewDto(
  review: ReviewRecord,
  opts: { includeCustomerId: boolean },
): ReviewDto {
  const reply = activeReply(review);
  return {
    id: review.id,
    productId: review.productId,
    skuId: review.skuId,
    skuCode: review.skuCode,
    orderId: review.orderId,
    orderItemId: review.orderItemId,
    customerId: opts.includeCustomerId ? review.customerId : undefined,
    displayName: review.displayName,
    rating: review.rating,
    title: review.title,
    content: review.content,
    verifiedPurchase: review.verifiedPurchase,
    status: review.status,
    helpfulCount: review.helpfulCount,
    reportCount: review.reportCount,
    hasMedia: review.hasMedia,
    media: review.media
      .filter((m) => !m.unlinkedAt)
      .map((m) => ({
        id: m.id,
        mediaId: m.mediaId,
        kind: m.kind,
        sortOrder: m.sortOrder,
        createdAt: m.createdAt.toISOString(),
      })),
    reply: reply ? toReplyDto(reply) : undefined,
    version: review.version,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    editedAt: review.editedAt?.toISOString(),
  };
}

function toReportDto(report: ReviewReportRecord): ReviewReportDto {
  return {
    id: report.id,
    reviewId: report.reviewId,
    reporterId: report.reporterId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    resolutionNote: report.resolutionNote,
    resolvedBy: report.resolvedBy,
    resolvedAt: report.resolvedAt?.toISOString(),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function toSummaryDto(
  productId: string,
  agg: {
    sumRating: number;
    totalReviews: number;
    verifiedReviews: number;
    mediaReviews: number;
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
    updatedAt: Date;
  },
): ProductRatingSummaryDto {
  return {
    productId,
    averageRating: averageRating(agg.sumRating, agg.totalReviews),
    averageRatingCents: averageRatingCents(agg.sumRating, agg.totalReviews),
    totalReviews: agg.totalReviews,
    verifiedReviews: agg.verifiedReviews,
    mediaReviews: agg.mediaReviews,
    ratingCounts: {
      star1: agg.star1,
      star2: agg.star2,
      star3: agg.star3,
      star4: agg.star4,
      star5: agg.star5,
    },
    updatedAt: agg.updatedAt.toISOString(),
  };
}

function assertVerifiedBuyer(
  order: OrderSnapshot,
  customerId: string,
  orderItemId: string,
): OrderSnapshot['items'][0] {
  if (order.customerId !== customerId) {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_NOT_VERIFIED_BUYER,
      message: 'Đơn hàng không thuộc về bạn',
    });
  }
  if (order.status !== 'DELIVERED') {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_ORDER_NOT_DELIVERED,
      message: 'Chỉ đánh giá đơn đã giao thành công',
      details: { status: order.status },
    });
  }
  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_NOT_VERIFIED_BUYER,
      message: 'Mục đơn hàng không tồn tại trong đơn',
      details: { orderItemId },
    });
  }
  const packageWithItem = order.packages.find((p) =>
    p.items.some((pi) => pi.orderItemId === orderItemId),
  );
  if (packageWithItem && packageWithItem.status !== 'DELIVERED') {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_ORDER_NOT_DELIVERED,
      message: 'Kiện hàng chứa sản phẩm chưa được giao',
      details: { packageStatus: packageWithItem.status },
    });
  }
  return item;
}

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly orderClient: OrderClient,
    private readonly catalogClient: CatalogClient,
    private readonly mediaClient: MediaClient,
    private readonly publisher: ReviewEventPublisher,
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
          errorCode: ErrorCodes.REVIEW_IDEMPOTENCY_CONFLICT,
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
          producer: 'review-service',
          traceId: event.traceId,
          payload: event.payload,
          eventId: event.id,
        }),
      );
      await this.repository.markOutboxPublished([event.id]);
    }
  }

  async createReview(actor: Actor, body: unknown, traceId = createId()) {
    requireAuth(actor);
    const input = createReviewRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      'createReview',
      async () => {
        const order = await this.orderClient.getOrder(input.orderId, {
          userId: actor.userId,
          roles: actor.roles,
          traceId,
        });
        const item = assertVerifiedBuyer(
          order,
          actor.userId,
          input.orderItemId,
        );

        const product = await this.catalogClient.getProduct(item.productId);
        if (!product) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_PRODUCT_NOT_FOUND,
            message: 'Không tìm thấy sản phẩm',
            details: { productId: item.productId },
          });
        }

        const existing = await this.repository.findActiveByCustomerOrderItem(
          actor.userId,
          input.orderItemId,
        );
        if (existing) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS,
            message: 'Bạn đã đánh giá mục đơn hàng này',
          });
        }

        if (input.rating < 1 || input.rating > 5) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_INVALID_RATING,
            message: 'Điểm đánh giá phải từ 1 đến 5',
          });
        }
        const content = sanitizeText(input.content);
        if (content.length < REVIEW_LIMITS.CONTENT_MIN) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_CONTENT_REQUIRED,
            message: 'Nội dung đánh giá không được để trống',
          });
        }

        const mediaInputs: Array<{
          mediaId: string;
          kind: ReviewMediaKind;
          sortOrder: number;
        }> = [];
        if (input.mediaIds?.length) {
          let images = 0;
          let videos = 0;
          for (const [idx, mediaId] of input.mediaIds.entries()) {
            const media = await this.mediaClient.getMedia(mediaId);
            if (!media || media.status === 'deleted') {
              throw new AppError({
                errorCode: ErrorCodes.REVIEW_MEDIA_NOT_FOUND,
                message: 'Không tìm thấy media',
                details: { mediaId },
              });
            }
            if (media.uploadedBy !== actor.userId && !isStaff(actor)) {
              throw new AppError({
                errorCode: ErrorCodes.REVIEW_MEDIA_FORBIDDEN,
                message: 'Media không thuộc về bạn',
                details: { mediaId },
              });
            }
            const kind = kindFromMime(media.mimeType);
            if (kind === 'IMAGE') {
              images += 1;
            } else {
              videos += 1;
            }
            if (
              images > REVIEW_LIMITS.MAX_IMAGES ||
              videos > REVIEW_LIMITS.MAX_VIDEOS
            ) {
              throw new AppError({
                errorCode: ErrorCodes.REVIEW_MEDIA_LIMIT,
                message: 'Vượt giới hạn số lượng media',
              });
            }
            mediaInputs.push({ mediaId, kind, sortOrder: idx });
          }
        }

        const status = initialReviewStatus(autoPublishEnabled());
        const displayName = maskDisplayName(
          input.displayName ??
            order.customerSnapshot?.displayName ??
            'Khách hàng',
        );

        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.REVIEW_CREATED,
            {
              productId: item.productId,
              orderId: order.id,
              orderItemId: item.id,
              rating: input.rating,
              status,
            },
            traceId,
          ),
        ];
        if (status === 'PUBLISHED') {
          outbox.push(
            buildOutbox(
              EventTypes.REVIEW_PUBLISHED,
              { productId: item.productId, rating: input.rating },
              traceId,
            ),
            buildOutbox(
              EventTypes.REVIEW_RATING_AGGREGATE_UPDATED,
              { productId: item.productId },
              traceId,
            ),
          );
        }

        const review = await this.repository.createReview({
          productId: item.productId,
          skuId: item.skuId,
          skuCode: item.skuCode,
          orderId: order.id,
          orderItemId: item.id,
          customerId: actor.userId,
          displayName,
          rating: input.rating,
          title: input.title ? sanitizeText(input.title) : undefined,
          content,
          verifiedPurchase: true,
          status,
          activeKey: `${actor.userId}:${item.id}`,
          media: mediaInputs,
          moderation: {
            action: 'create',
            actorId: actor.userId,
            actorType: 'customer',
            reason:
              status === 'PUBLISHED' ? 'auto-publish' : 'awaiting-moderation',
          },
          outbox,
          audit: {
            action: 'review.create',
            actorId: actor.userId,
            details: { orderId: order.id, orderItemId: item.id, status },
          },
        });

        await this.flushOutboxHint(traceId);
        return toReviewDto(review, { includeCustomerId: true });
      },
    );
  }

  async getReview(actor: Actor, reviewId: string): Promise<ReviewDto> {
    const review = await this.repository.findReviewById(reviewId);
    if (!review || review.status === 'DELETED') {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const isOwner = actor.userId && actor.userId === review.customerId;
    const staff = isStaff(actor);
    if (review.status !== 'PUBLISHED' && !isOwner && !staff) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    return toReviewDto(review, {
      includeCustomerId: Boolean(isOwner || staff),
    });
  }

  async updateReview(
    actor: Actor,
    reviewId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = updateReviewRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `updateReview:${reviewId}`,
      async () => {
        const review = await this.repository.findReviewById(reviewId);
        if (!review || review.status === 'DELETED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_NOT_FOUND,
            message: 'Không tìm thấy đánh giá',
          });
        }
        if (
          enforceResourceOwnership({
            resourceOwnerId: review.customerId,
            actorId: actor.userId,
            staffAllowed: false,
          }) === 'deny'
        ) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_FORBIDDEN,
            message: 'Bạn chỉ được sửa đánh giá của mình',
          });
        }
        if (review.status !== 'PENDING' && review.status !== 'PUBLISHED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
            message: 'Không thể sửa đánh giá ở trạng thái hiện tại',
            details: { status: review.status },
          });
        }
        if (Date.now() - review.createdAt.getTime() > editWindowMs()) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_EDIT_WINDOW_EXPIRED,
            message: `Chỉ được sửa trong ${REVIEW_LIMITS.EDIT_WINDOW_HOURS} giờ sau khi tạo`,
          });
        }

        const nextRating = input.rating ?? review.rating;
        const nextContent =
          input.content !== undefined
            ? sanitizeText(input.content)
            : review.content;
        if (nextContent.length < REVIEW_LIMITS.CONTENT_MIN) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_CONTENT_REQUIRED,
            message: 'Nội dung đánh giá không được để trống',
          });
        }
        const nextTitle =
          input.title === undefined
            ? review.title
            : input.title === null
              ? undefined
              : sanitizeText(input.title);

        const expectedVersion = input.expectedVersion ?? review.version;
        const aggregateDelta =
          review.status === 'PUBLISHED' && nextRating !== review.rating
            ? {
                productId: review.productId,
                remove: {
                  rating: review.rating,
                  verified: review.verifiedPurchase,
                  hasMedia: review.hasMedia,
                },
                add: {
                  rating: nextRating,
                  verified: review.verifiedPurchase,
                  hasMedia: review.hasMedia,
                },
              }
            : undefined;

        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.REVIEW_UPDATED,
            { reviewId, productId: review.productId, rating: nextRating },
            traceId,
          ),
        ];
        if (aggregateDelta) {
          outbox.push(
            buildOutbox(
              EventTypes.REVIEW_RATING_AGGREGATE_UPDATED,
              { productId: review.productId },
              traceId,
            ),
          );
        }

        const updated = await this.repository.updateReviewFields({
          reviewId,
          expectedVersion,
          rating: input.rating,
          title: input.title === undefined ? undefined : (nextTitle ?? null),
          content: input.content !== undefined ? nextContent : undefined,
          editedAt: new Date(),
          aggregateDelta,
          outbox,
          audit: {
            action: 'review.update',
            actorId: actor.userId,
            details: { reviewId },
          },
        });
        await this.flushOutboxHint(traceId);
        return toReviewDto(updated, { includeCustomerId: true });
      },
    );
  }

  async deleteReview(actor: Actor, reviewId: string, traceId = createId()) {
    requireAuth(actor);
    const review = await this.repository.findReviewById(reviewId);
    if (!review || review.status === 'DELETED') {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const staff = isStaff(actor);
    if (review.customerId !== actor.userId && !staff) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_FORBIDDEN,
        message: 'Bạn chỉ được xóa đánh giá của mình',
      });
    }
    assertTransition(review.status, 'DELETED');
    const wasPublished = review.status === 'PUBLISHED';
    const outbox: OutboxEventInput[] = [
      buildOutbox(
        EventTypes.REVIEW_DELETED,
        { reviewId, productId: review.productId },
        traceId,
      ),
    ];
    if (wasPublished) {
      outbox.push(
        buildOutbox(
          EventTypes.REVIEW_RATING_AGGREGATE_UPDATED,
          { productId: review.productId },
          traceId,
        ),
      );
    }
    const updated = await this.repository.transitionReview({
      reviewId,
      fromStatus: review.status,
      toStatus: 'DELETED',
      action: 'delete',
      actorId: actor.userId,
      actorType: staff ? 'staff' : 'customer',
      reason: staff ? 'staff-delete' : 'customer-delete',
      rotateActiveKey: `deleted:${createId()}`,
      aggregateDelta: wasPublished
        ? {
            productId: review.productId,
            remove: {
              rating: review.rating,
              verified: review.verifiedPurchase,
              hasMedia: review.hasMedia,
            },
          }
        : undefined,
      outbox,
      audit: {
        action: 'review.delete',
        actorId: actor.userId,
        details: { reviewId },
      },
    });
    await this.flushOutboxHint(traceId);
    return toReviewDto(updated, {
      includeCustomerId: true,
    });
  }

  async listProductReviews(productId: string, query: Record<string, unknown>) {
    const parsed = listProductReviewsQuerySchema.parse(query);
    const result = await this.repository.listReviews({
      productId,
      status: 'PUBLISHED',
      rating: parsed.rating,
      hasMedia: parsed.hasMedia,
      verifiedOnly: parsed.verifiedOnly,
      sort:
        parsed.sort === 'newest'
          ? 'newest'
          : parsed.sort === 'highest'
            ? 'highest'
            : parsed.sort === 'lowest'
              ? 'lowest'
              : 'most_helpful',
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((r) => toReviewDto(r, { includeCustomerId: false })),
      result.totalItems,
      parsed,
    );
  }

  async listMyReviews(actor: Actor, query: Record<string, unknown>) {
    requireAuth(actor);
    const page = Math.max(1, Number(query['page'] ?? 1) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query['pageSize'] ?? 50) || 50),
    );
    const result = await this.repository.listReviews({
      customerId: actor.userId,
      page,
      pageSize,
      sort: 'newest',
    });
    return createPaginatedResponse(
      result.items.map((r) => toReviewDto(r, { includeCustomerId: true })),
      result.totalItems,
      { page, pageSize },
    );
  }

  async getProductSummary(productId: string): Promise<ProductRatingSummaryDto> {
    const agg = await this.repository.getAggregate(productId);
    if (!agg) {
      return toSummaryDto(productId, {
        sumRating: 0,
        totalReviews: 0,
        verifiedReviews: 0,
        mediaReviews: 0,
        star1: 0,
        star2: 0,
        star3: 0,
        star4: 0,
        star5: 0,
        updatedAt: new Date(0),
      });
    }
    return toSummaryDto(productId, agg);
  }

  async addHelpful(actor: Actor, reviewId: string, traceId = createId()) {
    requireAuth(actor);
    const review = await this.repository.findReviewById(reviewId);
    if (!review || review.status !== 'PUBLISHED') {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (review.customerId === actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_SELF_VOTE_FORBIDDEN,
        message: 'Không thể tự đánh dấu hữu ích cho đánh giá của mình',
      });
    }
    const updated = await this.repository.addHelpfulVote(
      reviewId,
      actor.userId,
      [
        buildOutbox(
          EventTypes.REVIEW_HELPFUL_ADDED,
          { reviewId, customerId: actor.userId },
          traceId,
        ),
      ],
    );
    await this.flushOutboxHint(traceId);
    return toReviewDto(updated, { includeCustomerId: false });
  }

  async removeHelpful(actor: Actor, reviewId: string, traceId = createId()) {
    requireAuth(actor);
    const updated = await this.repository.removeHelpfulVote(
      reviewId,
      actor.userId,
      [
        buildOutbox(
          EventTypes.REVIEW_HELPFUL_REMOVED,
          { reviewId, customerId: actor.userId },
          traceId,
        ),
      ],
    );
    await this.flushOutboxHint(traceId);
    return toReviewDto(updated, { includeCustomerId: false });
  }

  async reportReview(
    actor: Actor,
    reviewId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = createReviewReportRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `report:${reviewId}:${input.reason}`,
      async () => {
        const review = await this.repository.findReviewById(reviewId);
        if (!review || review.status === 'DELETED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_NOT_FOUND,
            message: 'Không tìm thấy đánh giá',
          });
        }
        if (review.customerId === actor.userId) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_FORBIDDEN,
            message: 'Không thể tự báo cáo đánh giá của mình',
          });
        }
        const report = await this.repository.createReport(
          {
            reviewId,
            reporterId: actor.userId,
            reason: input.reason,
            description: input.description
              ? sanitizeText(input.description)
              : undefined,
          },
          [
            buildOutbox(
              EventTypes.REVIEW_REPORT_CREATED,
              { reviewId, reason: input.reason },
              traceId,
            ),
          ],
        );
        await this.flushOutboxHint(traceId);
        return toReportDto(report);
      },
    );
  }

  async attachMedia(
    actor: Actor,
    reviewId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = attachReviewMediaRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `attachMedia:${reviewId}:${input.mediaId}`,
      async () => {
        const review = await this.repository.findReviewById(reviewId);
        if (!review || review.status === 'DELETED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_NOT_FOUND,
            message: 'Không tìm thấy đánh giá',
          });
        }
        if (review.customerId !== actor.userId && !isStaff(actor)) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_FORBIDDEN,
            message: 'Không có quyền gắn media',
          });
        }
        const media = await this.mediaClient.getMedia(input.mediaId);
        if (!media || media.status === 'deleted') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_MEDIA_NOT_FOUND,
            message: 'Không tìm thấy media',
          });
        }
        if (media.uploadedBy !== actor.userId && !isStaff(actor)) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_MEDIA_FORBIDDEN,
            message: 'Media không thuộc về bạn',
          });
        }
        const kind = input.kind ?? kindFromMime(media.mimeType);
        const updated = await this.repository.attachMedia(
          reviewId,
          input.mediaId,
          kind,
          [
            buildOutbox(
              EventTypes.REVIEW_UPDATED,
              { reviewId, mediaId: input.mediaId, action: 'attach-media' },
              traceId,
            ),
          ],
        );
        await this.flushOutboxHint(traceId);
        return toReviewDto(updated, { includeCustomerId: true });
      },
    );
  }

  async unlinkMedia(
    actor: Actor,
    reviewId: string,
    mediaRowId: string,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const review = await this.repository.findReviewById(reviewId);
    if (!review || review.status === 'DELETED') {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    if (review.customerId !== actor.userId && !isStaff(actor)) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_FORBIDDEN,
        message: 'Không có quyền gỡ media',
      });
    }
    const updated = await this.repository.unlinkMedia(reviewId, mediaRowId, [
      buildOutbox(
        EventTypes.REVIEW_UPDATED,
        { reviewId, mediaRowId, action: 'unlink-media' },
        traceId,
      ),
    ]);
    await this.flushOutboxHint(traceId);
    return toReviewDto(updated, { includeCustomerId: true });
  }

  async createReply(
    actor: Actor,
    reviewId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = createReviewReplyRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `createReply:${reviewId}`,
      async () => {
        const review = await this.repository.findReviewById(reviewId);
        if (!review || review.status === 'DELETED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_NOT_FOUND,
            message: 'Không tìm thấy đánh giá',
          });
        }
        if (review.status !== 'PUBLISHED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_REPLY_NOT_ALLOWED,
            message: 'Chỉ phản hồi đánh giá đã xuất bản',
          });
        }
        const reply = await this.repository.createReply(
          reviewId,
          sanitizeText(input.content),
          actor.userId,
          undefined,
          [
            buildOutbox(
              EventTypes.REVIEW_REPLY_CREATED,
              { reviewId, staffId: actor.userId },
              traceId,
            ),
          ],
        );
        await this.flushOutboxHint(traceId);
        return toReplyDto(reply);
      },
    );
  }

  async updateReply(
    actor: Actor,
    reviewId: string,
    replyId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = updateReviewReplyRequestSchema.parse(body);
    const reply = await this.repository.updateReply(
      reviewId,
      replyId,
      sanitizeText(input.content),
      [
        buildOutbox(
          EventTypes.REVIEW_REPLY_UPDATED,
          { reviewId, replyId },
          traceId,
        ),
      ],
    );
    await this.flushOutboxHint(traceId);
    return toReplyDto(reply);
  }

  async deleteReply(
    actor: Actor,
    reviewId: string,
    replyId: string,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const reply = await this.repository.softDeleteReply(reviewId, replyId, [
      buildOutbox(
        EventTypes.REVIEW_REPLY_DELETED,
        { reviewId, replyId },
        traceId,
      ),
    ]);
    await this.flushOutboxHint(traceId);
    return toReplyDto(reply);
  }

  async adminListReviews(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listAdminReviewsQuerySchema.parse(query);
    const result = await this.repository.listReviews({
      status: parsed.status,
      productId: parsed.productId,
      customerId: parsed.customerId,
      reported: parsed.reported,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      sort:
        parsed.sort === 'oldest'
          ? 'oldest'
          : parsed.sort === 'most_reported'
            ? 'most_reported'
            : 'newest',
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((r) => toReviewDto(r, { includeCustomerId: true })),
      result.totalItems,
      parsed,
    );
  }

  async adminGetReview(
    actor: Actor,
    reviewId: string,
  ): Promise<AdminReviewDetailDto> {
    requireStaff(actor);
    const review = await this.repository.findReviewById(reviewId);
    if (!review) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_NOT_FOUND,
        message: 'Không tìm thấy đánh giá',
      });
    }
    const base = toReviewDto(review, { includeCustomerId: true });
    return {
      ...base,
      customerId: review.customerId,
      moderationHistory: review.moderationHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        action: h.action,
        actorId: h.actorId,
        actorType: h.actorType,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async moderate(
    actor: Actor,
    reviewId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = moderateReviewRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `moderate:${reviewId}:${input.action}`,
      async () => {
        const review = await this.repository.findReviewById(reviewId);
        if (!review || review.status === 'DELETED') {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_NOT_FOUND,
            message: 'Không tìm thấy đánh giá',
          });
        }
        const toStatus = resolveModerateTarget(input.action, review.status);
        assertTransition(review.status, toStatus);

        const wasPublished = review.status === 'PUBLISHED';
        const willPublish = toStatus === 'PUBLISHED';
        let aggregateDelta:
          | {
              productId: string;
              remove?: {
                rating: number;
                verified: boolean;
                hasMedia: boolean;
              };
              add?: { rating: number; verified: boolean; hasMedia: boolean };
            }
          | undefined;
        if (wasPublished && !willPublish) {
          aggregateDelta = {
            productId: review.productId,
            remove: {
              rating: review.rating,
              verified: review.verifiedPurchase,
              hasMedia: review.hasMedia,
            },
          };
        } else if (!wasPublished && willPublish) {
          aggregateDelta = {
            productId: review.productId,
            add: {
              rating: review.rating,
              verified: review.verifiedPurchase,
              hasMedia: review.hasMedia,
            },
          };
        }

        const eventType: EventType =
          toStatus === 'PUBLISHED'
            ? EventTypes.REVIEW_PUBLISHED
            : toStatus === 'HIDDEN'
              ? EventTypes.REVIEW_HIDDEN
              : toStatus === 'REJECTED'
                ? EventTypes.REVIEW_REJECTED
                : EventTypes.REVIEW_UPDATED;

        const outbox: OutboxEventInput[] = [
          buildOutbox(
            eventType,
            {
              reviewId,
              productId: review.productId,
              from: review.status,
              to: toStatus,
              reason: input.reason,
            },
            traceId,
          ),
        ];
        if (aggregateDelta) {
          outbox.push(
            buildOutbox(
              EventTypes.REVIEW_RATING_AGGREGATE_UPDATED,
              { productId: review.productId },
              traceId,
            ),
          );
        }

        const updated = await this.repository.transitionReview({
          reviewId,
          expectedVersion: input.expectedVersion,
          fromStatus: review.status,
          toStatus,
          action: input.action,
          actorId: actor.userId,
          actorType: 'staff',
          reason: input.reason,
          aggregateDelta,
          outbox,
          audit: {
            action: `review.moderate.${input.action}`,
            actorId: actor.userId,
            details: { reviewId, reason: input.reason },
          },
        });
        await this.flushOutboxHint(traceId);
        return toReviewDto(updated, { includeCustomerId: true });
      },
    );
  }

  async listReports(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listReviewReportsQuerySchema.parse(query);
    const result = await this.repository.listReports({
      status: parsed.status,
      reviewId: parsed.reviewId,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map(toReportDto),
      result.totalItems,
      parsed,
    );
  }

  async resolveReport(
    actor: Actor,
    reportId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = resolveReviewReportRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `resolveReport:${reportId}`,
      async () => {
        const report = await this.repository.findReportById(reportId);
        if (!report) {
          throw new AppError({
            errorCode: ErrorCodes.REVIEW_REPORT_NOT_FOUND,
            message: 'Không tìm thấy báo cáo',
          });
        }
        const resolved = await this.repository.resolveReport(
          reportId,
          input.resolution,
          sanitizeText(input.note),
          actor.userId,
          [
            buildOutbox(
              EventTypes.REVIEW_REPORT_RESOLVED,
              {
                reportId,
                resolution: input.resolution,
                reviewId: report.reviewId,
              },
              traceId,
            ),
          ],
        );
        if (input.hideReview) {
          const review = await this.repository.findReviewById(report.reviewId);
          if (review && review.status === 'PUBLISHED') {
            await this.moderate(
              actor,
              report.reviewId,
              {
                action: 'hide',
                reason: input.note,
              },
              traceId,
            );
          }
        }
        await this.flushOutboxHint(traceId);
        return toReportDto(resolved);
      },
    );
  }

  async rebuildAggregates(actor: Actor, body: unknown, traceId = createId()) {
    requireStaff(actor);
    const input = rebuildAggregatesRequestSchema.parse(body ?? {});
    if (input.productId) {
      const agg = await this.repository.rebuildAggregate(input.productId);
      await this.repository.addOutbox([
        buildOutbox(
          EventTypes.REVIEW_RATING_AGGREGATE_UPDATED,
          { productId: input.productId, rebuilt: true },
          traceId,
        ),
      ]);
      await this.flushOutboxHint(traceId);
      return { rebuilt: 1, summary: toSummaryDto(input.productId, agg) };
    }
    const count = await this.repository.rebuildAllAggregates();
    await this.flushOutboxHint(traceId);
    return { rebuilt: count };
  }
}
