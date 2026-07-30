import { createId } from '@nexatech/shared-platform';
import {
  attachWarrantyEvidenceRequestSchema,
  createPaginatedResponse,
  createReturnRequestSchema,
  createWarrantyClaimRequestSchema,
  listAdminReturnRequestsQuerySchema,
  listAdminWarrantyClaimsQuerySchema,
  listReturnRequestsQuerySchema,
  listWarrantyClaimsQuerySchema,
  transitionReturnRequestSchema,
  transitionWarrantyClaimRequestSchema,
  WARRANTY_LIMITS,
  type AdminReturnRequestDetailDto,
  type AdminWarrantyClaimDetailDto,
  type ReturnRequestDto,
  type ReturnRequestTransitionAction,
  type WarrantyClaimDto,
  type WarrantyClaimTransitionAction,
  type WarrantyMediaKind,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { enforceResourceOwnership } from '@nexatech/shared-security-lab';
import {
  EventTypes,
  createEventEnvelope,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import { z } from 'zod';
import { isClaimTerminal, resolveClaimTransition } from './claim-state-machine';
import type { WarrantyEventPublisher } from './event-publisher';
import type { MediaClient } from './media.client';
import type { OrderClient } from './order.client';
import { generateClaimCode, generateReturnCode } from './warranty-code';
import {
  isReturnTerminal,
  resolveOrderSyncTarget,
  resolveReturnTransition,
} from './return-state-machine';
import type { WarrantyRepository } from './warranty.repository';
import type {
  Actor,
  OrderSnapshot,
  OutboxEventInput,
  ReturnRequestRecord,
  WarrantyClaimRecord,
} from './warranty.types';

const STAFF_ROLES = new Set(['Staff', 'Manager', 'Admin', 'SuperAdmin']);

const cancelBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
  expectedVersion: z.coerce.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

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

/** Strip angle brackets / control chars for render-safe display. */
function sanitizeText(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (ch === '<' || ch === '>') {
      continue;
    }
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    out += ch;
  }
  return out.trim();
}

function kindFromMime(mimeType: string): WarrantyMediaKind {
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }
  throw new AppError({
    errorCode: ErrorCodes.WARRANTY_MEDIA_INVALID,
    message: 'Minh chứng chỉ chấp nhận định dạng ảnh',
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

function assertVerifiedBuyer(
  order: OrderSnapshot,
  customerId: string,
  orderItemId: string,
): OrderSnapshot['items'][0] {
  if (order.customerId !== customerId) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_NOT_VERIFIED_BUYER,
      message: 'Đơn hàng không thuộc về bạn',
    });
  }
  if (order.status !== 'DELIVERED') {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_ORDER_NOT_DELIVERED,
      message: 'Chỉ áp dụng cho đơn đã giao thành công',
      details: { status: order.status },
    });
  }
  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_NOT_VERIFIED_BUYER,
      message: 'Mục đơn hàng không tồn tại trong đơn',
      details: { orderItemId },
    });
  }
  const packageWithItem = order.packages.find((p) =>
    p.items.some((pi) => pi.orderItemId === orderItemId),
  );
  if (packageWithItem && packageWithItem.status !== 'DELIVERED') {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_ORDER_NOT_DELIVERED,
      message: 'Kiện hàng chứa sản phẩm chưa được giao',
      details: { packageStatus: packageWithItem.status },
    });
  }
  return item;
}

const CLAIM_EVENT_BY_ACTION: Record<WarrantyClaimTransitionAction, EventType> =
  {
    start_review: EventTypes.WARRANTY_CLAIM_UPDATED,
    approve: EventTypes.WARRANTY_CLAIM_APPROVED,
    reject: EventTypes.WARRANTY_CLAIM_REJECTED,
    start_repair: EventTypes.WARRANTY_CLAIM_UPDATED,
    complete: EventTypes.WARRANTY_CLAIM_COMPLETED,
    cancel: EventTypes.WARRANTY_CLAIM_CANCELLED,
  };

const RETURN_EVENT_BY_ACTION: Record<ReturnRequestTransitionAction, EventType> =
  {
    start_review: EventTypes.WARRANTY_RETURN_UPDATED,
    approve: EventTypes.WARRANTY_RETURN_APPROVED,
    reject: EventTypes.WARRANTY_RETURN_REJECTED,
    mark_awaiting_return: EventTypes.WARRANTY_RETURN_UPDATED,
    mark_received: EventTypes.WARRANTY_RETURN_UPDATED,
    complete: EventTypes.WARRANTY_RETURN_COMPLETED,
    cancel: EventTypes.WARRANTY_RETURN_CANCELLED,
  };

function toClaimDto(
  claim: WarrantyClaimRecord,
  opts: { includeCustomerId: boolean },
): WarrantyClaimDto {
  return {
    id: claim.id,
    claimCode: claim.claimCode,
    orderId: claim.orderId,
    orderCode: claim.orderCode,
    orderItemId: claim.orderItemId,
    customerId: opts.includeCustomerId ? claim.customerId : undefined,
    productId: claim.productId,
    skuId: claim.skuId,
    skuCode: claim.skuCode,
    productName: claim.productName,
    issueType: claim.issueType,
    description: claim.description,
    serialNumber: claim.serialNumber,
    status: claim.status,
    media: claim.media
      .filter((m) => !m.deletedAt)
      .map((m) => ({
        id: m.id,
        mediaId: m.mediaId,
        kind: m.kind,
        createdAt: m.createdAt.toISOString(),
      })),
    version: claim.version,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

function toAdminClaimDto(
  claim: WarrantyClaimRecord,
): AdminWarrantyClaimDetailDto {
  const base = toClaimDto(claim, { includeCustomerId: true });
  return {
    ...base,
    customerId: claim.customerId,
    history: claim.history.map((h) => ({
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

function toReturnDto(
  returnRequest: ReturnRequestRecord,
  opts: { includeCustomerId: boolean },
): ReturnRequestDto {
  return {
    id: returnRequest.id,
    returnCode: returnRequest.returnCode,
    orderId: returnRequest.orderId,
    orderCode: returnRequest.orderCode,
    orderItemId: returnRequest.orderItemId,
    customerId: opts.includeCustomerId ? returnRequest.customerId : undefined,
    productId: returnRequest.productId,
    skuId: returnRequest.skuId,
    skuCode: returnRequest.skuCode,
    productName: returnRequest.productName,
    reason: returnRequest.reason,
    description: returnRequest.description,
    quantity: returnRequest.quantity,
    desiredResolution: returnRequest.desiredResolution,
    status: returnRequest.status,
    media: returnRequest.media
      .filter((m) => !m.deletedAt)
      .map((m) => ({
        id: m.id,
        mediaId: m.mediaId,
        kind: m.kind,
        createdAt: m.createdAt.toISOString(),
      })),
    orderSyncedStatus: returnRequest.orderSyncedStatus,
    orderSyncedAt: returnRequest.orderSyncedAt?.toISOString(),
    version: returnRequest.version,
    createdAt: returnRequest.createdAt.toISOString(),
    updatedAt: returnRequest.updatedAt.toISOString(),
  };
}

function toAdminReturnDto(
  returnRequest: ReturnRequestRecord,
): AdminReturnRequestDetailDto {
  const base = toReturnDto(returnRequest, { includeCustomerId: true });
  return {
    ...base,
    customerId: returnRequest.customerId,
    history: returnRequest.history.map((h) => ({
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

export class WarrantyService {
  constructor(
    private readonly repository: WarrantyRepository,
    private readonly orderClient: OrderClient,
    private readonly mediaClient: MediaClient,
    private readonly publisher: WarrantyEventPublisher,
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
          errorCode: ErrorCodes.WARRANTY_IDEMPOTENCY_CONFLICT,
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
          producer: 'warranty-service',
          traceId: event.traceId,
          payload: event.payload,
          eventId: event.id,
        }),
      );
      await this.repository.markOutboxPublished([event.id]);
    }
  }

  private async validateMediaIds(
    actor: Actor,
    mediaIds: string[] | undefined,
  ): Promise<Array<{ mediaId: string; kind: WarrantyMediaKind }>> {
    const mediaInputs: Array<{ mediaId: string; kind: WarrantyMediaKind }> = [];
    if (!mediaIds?.length) {
      return mediaInputs;
    }
    if (mediaIds.length > WARRANTY_LIMITS.MAX_IMAGES) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT,
        message: `Tối đa ${WARRANTY_LIMITS.MAX_IMAGES} ảnh minh chứng`,
      });
    }
    for (const mediaId of mediaIds) {
      const media = await this.mediaClient.getMedia(mediaId);
      if (!media || media.status === 'deleted') {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_MEDIA_NOT_FOUND,
          message: 'Không tìm thấy media',
          details: { mediaId },
        });
      }
      if (media.uploadedBy !== actor.userId && !isStaff(actor)) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_MEDIA_FORBIDDEN,
          message: 'Media không thuộc về bạn',
          details: { mediaId },
        });
      }
      const kind = kindFromMime(media.mimeType);
      mediaInputs.push({ mediaId, kind });
    }
    return mediaInputs;
  }

  /** ===================== Claims ===================== */

  async createWarrantyClaim(actor: Actor, body: unknown, traceId = createId()) {
    requireAuth(actor);
    const input = createWarrantyClaimRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      'createWarrantyClaim',
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

        const existing =
          await this.repository.findActiveClaimByCustomerOrderItem(
            actor.userId,
            item.id,
          );
        if (existing) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
            message: 'Bạn đã có yêu cầu bảo hành đang xử lý cho mục này',
          });
        }

        const description = sanitizeText(input.description);
        if (description.length < WARRANTY_LIMITS.DESCRIPTION_MIN) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_DESCRIPTION_REQUIRED,
            message: 'Mô tả sự cố không được để trống',
          });
        }

        const mediaInputs = await this.validateMediaIds(actor, input.mediaIds);

        const claimCode = generateClaimCode();
        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.WARRANTY_CLAIM_CREATED,
            {
              claimCode,
              orderId: order.id,
              orderItemId: item.id,
              productId: item.productId,
              issueType: input.issueType,
            },
            traceId,
          ),
        ];

        const claim = await this.repository.createClaim({
          claimCode,
          orderId: order.id,
          orderCode: order.orderCode,
          orderItemId: item.id,
          customerId: actor.userId,
          productId: item.productId,
          skuId: item.skuId,
          skuCode: item.skuCode,
          productName: item.productName,
          issueType: input.issueType,
          description,
          serialNumber: input.serialNumber,
          activeKey: `${actor.userId}:${item.id}`,
          media: mediaInputs,
          outbox,
          audit: {
            action: 'warranty.claim.create',
            actorId: actor.userId,
            details: { orderId: order.id, orderItemId: item.id },
          },
        });

        await this.flushOutboxHint(traceId);
        return toClaimDto(claim, { includeCustomerId: true });
      },
    );
  }

  async getClaim(actor: Actor, claimId: string): Promise<WarrantyClaimDto> {
    requireAuth(actor);
    const claim = await this.repository.findClaimById(claimId);
    if (!claim) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu bảo hành',
      });
    }
    const staff = isStaff(actor);
    if (
      enforceResourceOwnership({
        resourceOwnerId: claim.customerId,
        actorId: actor.userId,
        actorIsStaff: staff,
        staffAllowed: true,
      }) === 'deny'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
        message: 'Không có quyền xem yêu cầu bảo hành này',
      });
    }
    return toClaimDto(claim, { includeCustomerId: staff });
  }

  async listMyClaims(actor: Actor, query: Record<string, unknown>) {
    requireAuth(actor);
    const parsed = listWarrantyClaimsQuerySchema.parse(query);
    const result = await this.repository.listClaims({
      customerId: actor.userId,
      status: parsed.status,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((c) => toClaimDto(c, { includeCustomerId: false })),
      result.totalItems,
      parsed,
    );
  }

  async attachClaimMedia(
    actor: Actor,
    claimId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = attachWarrantyEvidenceRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `attachClaimMedia:${claimId}:${input.mediaId}`,
      async () => {
        const claim = await this.repository.findClaimById(claimId);
        if (!claim) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu bảo hành',
          });
        }
        if (claim.customerId !== actor.userId && !isStaff(actor)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
            message: 'Không có quyền gắn minh chứng',
          });
        }
        if (isClaimTerminal(claim.status)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
            message: 'Yêu cầu bảo hành đã kết thúc, không thể thêm minh chứng',
          });
        }
        const [media] = await this.validateMediaIds(actor, [input.mediaId]);
        const updated = await this.repository.attachClaimMedia(
          claimId,
          media.mediaId,
          media.kind,
          [
            buildOutbox(
              EventTypes.WARRANTY_CLAIM_UPDATED,
              { claimId, mediaId: input.mediaId, action: 'attach-media' },
              traceId,
            ),
          ],
        );
        await this.flushOutboxHint(traceId);
        return toClaimDto(updated, { includeCustomerId: true });
      },
    );
  }

  private async applyClaimTransition(
    actor: Actor,
    claimId: string,
    action: WarrantyClaimTransitionAction,
    opts: {
      reason?: string;
      expectedVersion?: number;
      requireOwnership: boolean;
    },
    traceId: string,
  ): Promise<WarrantyClaimDto> {
    const claim = await this.repository.findClaimById(claimId);
    if (!claim) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu bảo hành',
      });
    }
    if (opts.requireOwnership && claim.customerId !== actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
        message: 'Không có quyền thao tác yêu cầu bảo hành này',
      });
    }
    const toStatus = resolveClaimTransition(claim.status, action);
    const rotateActiveKey = isClaimTerminal(toStatus)
      ? `${toStatus}:${createId()}`
      : undefined;

    const outbox: OutboxEventInput[] = [
      buildOutbox(
        CLAIM_EVENT_BY_ACTION[action],
        {
          claimId,
          orderId: claim.orderId,
          from: claim.status,
          to: toStatus,
          reason: opts.reason,
        },
        traceId,
      ),
    ];

    const updated = await this.repository.transitionClaim({
      claimId,
      expectedVersion: opts.expectedVersion,
      fromStatus: claim.status,
      toStatus,
      action,
      actorId: actor.userId,
      actorType: isStaff(actor) ? 'staff' : 'customer',
      reason: opts.reason,
      rotateActiveKey,
      outbox,
      audit: {
        action: `warranty.claim.${action}`,
        actorId: actor.userId,
        details: { claimId, reason: opts.reason },
      },
    });
    await this.flushOutboxHint(traceId);
    return toClaimDto(updated, { includeCustomerId: true });
  }

  async cancelClaim(
    actor: Actor,
    claimId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = cancelBodySchema.parse(body ?? {});
    return this.withIdempotency(
      input.idempotencyKey,
      `cancelClaim:${claimId}`,
      () =>
        this.applyClaimTransition(
          actor,
          claimId,
          'cancel',
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: true,
          },
          traceId,
        ),
    );
  }

  async adminListClaims(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listAdminWarrantyClaimsQuerySchema.parse(query);
    const result = await this.repository.listClaims({
      status: parsed.status,
      customerId: parsed.customerId,
      orderId: parsed.orderId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((c) => toClaimDto(c, { includeCustomerId: true })),
      result.totalItems,
      parsed,
    );
  }

  async adminGetClaim(
    actor: Actor,
    claimId: string,
  ): Promise<AdminWarrantyClaimDetailDto> {
    requireStaff(actor);
    const claim = await this.repository.findClaimById(claimId);
    if (!claim) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu bảo hành',
      });
    }
    return toAdminClaimDto(claim);
  }

  async adminTransitionClaim(
    actor: Actor,
    claimId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = transitionWarrantyClaimRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `adminTransitionClaim:${claimId}:${input.action}`,
      () =>
        this.applyClaimTransition(
          actor,
          claimId,
          input.action,
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: false,
          },
          traceId,
        ),
    );
  }

  /** ===================== Returns ===================== */

  async createReturnRequest(actor: Actor, body: unknown, traceId = createId()) {
    requireAuth(actor);
    const input = createReturnRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      'createReturnRequest',
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

        if (input.quantity > item.quantity) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_QUANTITY_INVALID,
            message: 'Số lượng đổi trả vượt quá số lượng đã mua',
            details: { requested: input.quantity, purchased: item.quantity },
          });
        }

        const existing =
          await this.repository.findActiveReturnByCustomerOrderItem(
            actor.userId,
            item.id,
          );
        if (existing) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
            message: 'Bạn đã có yêu cầu đổi trả đang xử lý cho mục này',
          });
        }

        const description = sanitizeText(input.description);
        if (description.length < WARRANTY_LIMITS.DESCRIPTION_MIN) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_DESCRIPTION_REQUIRED,
            message: 'Mô tả lý do đổi trả không được để trống',
          });
        }

        const mediaInputs = await this.validateMediaIds(actor, input.mediaIds);

        const returnCode = generateReturnCode();
        const outbox: OutboxEventInput[] = [
          buildOutbox(
            EventTypes.WARRANTY_RETURN_REQUESTED,
            {
              returnCode,
              orderId: order.id,
              orderItemId: item.id,
              productId: item.productId,
              reason: input.reason,
              quantity: input.quantity,
            },
            traceId,
          ),
        ];

        const returnRequest = await this.repository.createReturn({
          returnCode,
          orderId: order.id,
          orderCode: order.orderCode,
          orderItemId: item.id,
          customerId: actor.userId,
          productId: item.productId,
          skuId: item.skuId,
          skuCode: item.skuCode,
          productName: item.productName,
          reason: input.reason,
          description,
          quantity: input.quantity,
          desiredResolution: input.desiredResolution,
          activeKey: `${actor.userId}:${item.id}`,
          media: mediaInputs,
          outbox,
          audit: {
            action: 'warranty.return.create',
            actorId: actor.userId,
            details: { orderId: order.id, orderItemId: item.id },
          },
        });

        await this.flushOutboxHint(traceId);
        return toReturnDto(returnRequest, { includeCustomerId: true });
      },
    );
  }

  async getReturn(actor: Actor, returnId: string): Promise<ReturnRequestDto> {
    requireAuth(actor);
    const returnRequest = await this.repository.findReturnById(returnId);
    if (!returnRequest) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu đổi trả',
      });
    }
    const staff = isStaff(actor);
    if (returnRequest.customerId !== actor.userId && !staff) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
        message: 'Không có quyền xem yêu cầu đổi trả này',
      });
    }
    return toReturnDto(returnRequest, { includeCustomerId: staff });
  }

  async listMyReturns(actor: Actor, query: Record<string, unknown>) {
    requireAuth(actor);
    const parsed = listReturnRequestsQuerySchema.parse(query);
    const result = await this.repository.listReturns({
      customerId: actor.userId,
      status: parsed.status,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((r) => toReturnDto(r, { includeCustomerId: false })),
      result.totalItems,
      parsed,
    );
  }

  async attachReturnMedia(
    actor: Actor,
    returnId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = attachWarrantyEvidenceRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `attachReturnMedia:${returnId}:${input.mediaId}`,
      async () => {
        const returnRequest = await this.repository.findReturnById(returnId);
        if (!returnRequest) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
            message: 'Không tìm thấy yêu cầu đổi trả',
          });
        }
        if (returnRequest.customerId !== actor.userId && !isStaff(actor)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
            message: 'Không có quyền gắn minh chứng',
          });
        }
        if (isReturnTerminal(returnRequest.status)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
            message: 'Yêu cầu đổi trả đã kết thúc, không thể thêm minh chứng',
          });
        }
        const [media] = await this.validateMediaIds(actor, [input.mediaId]);
        const updated = await this.repository.attachReturnMedia(
          returnId,
          media.mediaId,
          media.kind,
          [
            buildOutbox(
              EventTypes.WARRANTY_RETURN_UPDATED,
              { returnId, mediaId: input.mediaId, action: 'attach-media' },
              traceId,
            ),
          ],
        );
        await this.flushOutboxHint(traceId);
        return toReturnDto(updated, { includeCustomerId: true });
      },
    );
  }

  private async applyReturnTransition(
    actor: Actor,
    returnId: string,
    action: ReturnRequestTransitionAction,
    opts: {
      reason?: string;
      expectedVersion?: number;
      requireOwnership: boolean;
    },
    traceId: string,
  ): Promise<ReturnRequestDto> {
    const returnRequest = await this.repository.findReturnById(returnId);
    if (!returnRequest) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu đổi trả',
      });
    }
    if (opts.requireOwnership && returnRequest.customerId !== actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_FORBIDDEN,
        message: 'Không có quyền thao tác yêu cầu đổi trả này',
      });
    }
    const toStatus = resolveReturnTransition(returnRequest.status, action);
    const rotateActiveKey = isReturnTerminal(toStatus)
      ? `${toStatus}:${createId()}`
      : undefined;

    const syncTarget = resolveOrderSyncTarget(
      toStatus,
      returnRequest.orderSyncedStatus,
    );
    let orderSync: { status: string; syncedAt: Date } | undefined;
    if (syncTarget) {
      // Inter-service sync luôn dùng Staff — không phụ thuộc role customer khi cancel
      await this.orderClient.syncReturn(
        returnRequest.orderId,
        {
          orderItemId: returnRequest.orderItemId,
          toStatus: syncTarget,
          idempotencyKey: `${returnRequest.id}:${syncTarget}`,
        },
        {
          userId:
            process.env['WARRANTY_SERVICE_ACTOR_ID'] ?? 'warranty-service',
          roles: ['Staff'],
          traceId,
        },
      );
      orderSync = { status: syncTarget, syncedAt: new Date() };
    }

    const outbox: OutboxEventInput[] = [
      buildOutbox(
        RETURN_EVENT_BY_ACTION[action],
        {
          returnId,
          orderId: returnRequest.orderId,
          from: returnRequest.status,
          to: toStatus,
          reason: opts.reason,
        },
        traceId,
      ),
    ];
    if (action === 'mark_received') {
      outbox.push(
        buildOutbox(
          EventTypes.WARRANTY_INVENTORY_RETURN_REQUESTED,
          {
            returnId,
            orderItemId: returnRequest.orderItemId,
            skuCode: returnRequest.skuCode,
            quantity: returnRequest.quantity,
          },
          traceId,
        ),
      );
    }
    if (action === 'complete' && returnRequest.desiredResolution === 'REFUND') {
      outbox.push(
        buildOutbox(
          EventTypes.WARRANTY_REFUND_REQUESTED,
          {
            returnId,
            orderId: returnRequest.orderId,
            customerId: returnRequest.customerId,
            quantity: returnRequest.quantity,
          },
          traceId,
        ),
      );
    }

    const updated = await this.repository.transitionReturn({
      returnId,
      expectedVersion: opts.expectedVersion,
      fromStatus: returnRequest.status,
      toStatus,
      action,
      actorId: actor.userId,
      actorType: isStaff(actor) ? 'staff' : 'customer',
      reason: opts.reason,
      rotateActiveKey,
      orderSync,
      outbox,
      audit: {
        action: `warranty.return.${action}`,
        actorId: actor.userId,
        details: { returnId, reason: opts.reason },
      },
    });
    await this.flushOutboxHint(traceId);
    return toReturnDto(updated, { includeCustomerId: true });
  }

  async cancelReturn(
    actor: Actor,
    returnId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireAuth(actor);
    const input = cancelBodySchema.parse(body ?? {});
    return this.withIdempotency(
      input.idempotencyKey,
      `cancelReturn:${returnId}`,
      () =>
        this.applyReturnTransition(
          actor,
          returnId,
          'cancel',
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: true,
          },
          traceId,
        ),
    );
  }

  async adminListReturns(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listAdminReturnRequestsQuerySchema.parse(query);
    const result = await this.repository.listReturns({
      status: parsed.status,
      customerId: parsed.customerId,
      orderId: parsed.orderId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map((r) => toReturnDto(r, { includeCustomerId: true })),
      result.totalItems,
      parsed,
    );
  }

  async adminGetReturn(
    actor: Actor,
    returnId: string,
  ): Promise<AdminReturnRequestDetailDto> {
    requireStaff(actor);
    const returnRequest = await this.repository.findReturnById(returnId);
    if (!returnRequest) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu đổi trả',
      });
    }
    return toAdminReturnDto(returnRequest);
  }

  async adminTransitionReturn(
    actor: Actor,
    returnId: string,
    body: unknown,
    traceId = createId(),
  ) {
    requireStaff(actor);
    const input = transitionReturnRequestSchema.parse(body);
    return this.withIdempotency(
      input.idempotencyKey,
      `adminTransitionReturn:${returnId}:${input.action}`,
      () =>
        this.applyReturnTransition(
          actor,
          returnId,
          input.action,
          {
            reason: input.reason,
            expectedVersion: input.expectedVersion,
            requireOwnership: false,
          },
          traceId,
        ),
    );
  }
}
