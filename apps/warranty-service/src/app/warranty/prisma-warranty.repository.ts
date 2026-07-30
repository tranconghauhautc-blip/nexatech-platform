import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from './prisma.service';
import type { WarrantyRepository } from './warranty.repository';
import type {
  CreateClaimInput,
  CreateReturnInput,
  IdempotencyRecord,
  ListClaimsFilter,
  ListClaimsResult,
  ListReturnsFilter,
  ListReturnsResult,
  OutboxEventInput,
  OutboxEventRecord,
  ReturnRequestMediaRecord,
  ReturnRequestRecord,
  TransitionClaimInput,
  TransitionReturnInput,
  WarrantyClaimMediaRecord,
  WarrantyClaimRecord,
} from './warranty.types';

const CLAIM_INCLUDE = {
  media: true,
  history: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.WarrantyClaimInclude;

const RETURN_INCLUDE = {
  media: true,
  history: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ReturnRequestInclude;

type PrismaClaimFull = Prisma.WarrantyClaimGetPayload<{
  include: typeof CLAIM_INCLUDE;
}>;
type PrismaReturnFull = Prisma.ReturnRequestGetPayload<{
  include: typeof RETURN_INCLUDE;
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

function mapClaimMedia(
  row: PrismaClaimFull['media'][number],
): WarrantyClaimMediaRecord {
  return {
    id: row.id,
    claimId: row.claimId,
    mediaId: row.mediaId,
    kind: row.kind,
    deletedAt: row.deletedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapClaimHistory(
  row: PrismaClaimFull['history'][number],
): WarrantyClaimRecord['history'][number] {
  return {
    id: row.id,
    claimId: row.claimId,
    fromStatus: row.fromStatus ?? undefined,
    toStatus: row.toStatus,
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapClaim(row: PrismaClaimFull): WarrantyClaimRecord {
  return {
    id: row.id,
    claimCode: row.claimCode,
    orderId: row.orderId,
    orderCode: row.orderCode,
    orderItemId: row.orderItemId,
    customerId: row.customerId,
    productId: row.productId,
    skuId: row.skuId ?? undefined,
    skuCode: row.skuCode ?? undefined,
    productName: row.productName,
    issueType: row.issueType,
    description: row.description,
    serialNumber: row.serialNumber ?? undefined,
    status: row.status,
    activeKey: row.activeKey,
    version: row.version,
    orderSyncedStatus: row.orderSyncedStatus ?? undefined,
    orderSyncedAt: row.orderSyncedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    media: row.media.map(mapClaimMedia),
    history: row.history.map(mapClaimHistory),
  };
}

function mapReturnMedia(
  row: PrismaReturnFull['media'][number],
): ReturnRequestMediaRecord {
  return {
    id: row.id,
    returnId: row.returnId,
    mediaId: row.mediaId,
    kind: row.kind,
    deletedAt: row.deletedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapReturnHistory(
  row: PrismaReturnFull['history'][number],
): ReturnRequestRecord['history'][number] {
  return {
    id: row.id,
    returnId: row.returnId,
    fromStatus: row.fromStatus ?? undefined,
    toStatus: row.toStatus,
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapReturn(row: PrismaReturnFull): ReturnRequestRecord {
  return {
    id: row.id,
    returnCode: row.returnCode,
    orderId: row.orderId,
    orderCode: row.orderCode,
    orderItemId: row.orderItemId,
    customerId: row.customerId,
    productId: row.productId,
    skuId: row.skuId ?? undefined,
    skuCode: row.skuCode ?? undefined,
    productName: row.productName,
    reason: row.reason,
    description: row.description,
    quantity: row.quantity,
    desiredResolution: row.desiredResolution,
    status: row.status,
    activeKey: row.activeKey,
    version: row.version,
    orderSyncedStatus: row.orderSyncedStatus ?? undefined,
    orderSyncedAt: row.orderSyncedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    media: row.media.map(mapReturnMedia),
    history: row.history.map(mapReturnHistory),
  };
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

async function loadClaim(
  client: DbClient,
  id: string,
): Promise<PrismaClaimFull | null> {
  return client.warrantyClaim.findUnique({
    where: { id },
    include: CLAIM_INCLUDE,
  });
}

async function loadClaimOrThrow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<PrismaClaimFull> {
  const row = await loadClaim(tx, id);
  if (!row) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
      message: 'Không tìm thấy yêu cầu bảo hành',
    });
  }
  return row;
}

async function loadReturn(
  client: DbClient,
  id: string,
): Promise<PrismaReturnFull | null> {
  return client.returnRequest.findUnique({
    where: { id },
    include: RETURN_INCLUDE,
  });
}

async function loadReturnOrThrow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<PrismaReturnFull> {
  const row = await loadReturn(tx, id);
  if (!row) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
      message: 'Không tìm thấy yêu cầu đổi trả',
    });
  }
  return row;
}

function buildListClaimsWhere(
  filter: ListClaimsFilter,
): Prisma.WarrantyClaimWhereInput {
  const where: Prisma.WarrantyClaimWhereInput = {};
  if (filter.customerId) {
    where.customerId = filter.customerId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.orderId) {
    where.orderId = filter.orderId;
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

function buildListReturnsWhere(
  filter: ListReturnsFilter,
): Prisma.ReturnRequestWhereInput {
  const where: Prisma.ReturnRequestWhereInput = {};
  if (filter.customerId) {
    where.customerId = filter.customerId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.orderId) {
    where.orderId = filter.orderId;
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

export class PrismaWarrantyRepository implements WarrantyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** ---------- claims ---------- */

  async createClaim(input: CreateClaimInput): Promise<WarrantyClaimRecord> {
    return this.prisma.$transaction(async (tx) => {
      const byActiveKey = await tx.warrantyClaim.findUnique({
        where: { activeKey: input.activeKey },
      });
      if (byActiveKey) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
          message: 'Bạn đã có yêu cầu bảo hành đang xử lý cho mục đơn hàng này',
          details: { orderItemId: input.orderItemId },
        });
      }

      const id = createId();
      const mediaRows = (input.media ?? []).map((m) => ({
        id: createId(),
        mediaId: m.mediaId,
        kind: m.kind,
      }));

      try {
        await tx.warrantyClaim.create({
          data: {
            id,
            claimCode: input.claimCode,
            orderId: input.orderId,
            orderCode: input.orderCode,
            orderItemId: input.orderItemId,
            customerId: input.customerId,
            productId: input.productId,
            skuId: input.skuId,
            skuCode: input.skuCode,
            productName: input.productName,
            issueType: input.issueType,
            description: input.description,
            serialNumber: input.serialNumber,
            status: 'SUBMITTED',
            activeKey: input.activeKey,
            media: { create: mediaRows },
            history: {
              create: {
                id: createId(),
                toStatus: 'SUBMITTED',
                action: 'create',
                actorId: input.customerId,
                actorType: 'customer',
              },
            },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
            message:
              'Bạn đã có yêu cầu bảo hành đang xử lý cho mục đơn hàng này',
            details: { orderItemId: input.orderItemId },
          });
        }
        throw error;
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

      const row = await loadClaimOrThrow(tx, id);
      return mapClaim(row);
    });
  }

  async findClaimById(id: string): Promise<WarrantyClaimRecord | null> {
    const row = await loadClaim(this.prisma, id);
    return row ? mapClaim(row) : null;
  }

  async findActiveClaimByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<WarrantyClaimRecord | null> {
    const row = await this.prisma.warrantyClaim.findFirst({
      where: {
        customerId,
        orderItemId,
        activeKey: `${customerId}:${orderItemId}`,
      },
      include: CLAIM_INCLUDE,
    });
    return row ? mapClaim(row) : null;
  }

  async transitionClaim(
    input: TransitionClaimInput,
  ): Promise<WarrantyClaimRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadClaimOrThrow(tx, input.claimId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_CONFLICT,
          message: 'Yêu cầu bảo hành đã được cập nhật bởi thao tác khác',
        });
      }
      if (current.status !== input.fromStatus) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
          message: 'Trạng thái yêu cầu bảo hành không khớp',
          details: { expected: input.fromStatus, actual: current.status },
        });
      }

      const where: Prisma.WarrantyClaimWhereInput = {
        id: input.claimId,
        status: input.fromStatus,
      };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.warrantyClaim.updateMany({
        where,
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
          ...(input.rotateActiveKey
            ? { activeKey: input.rotateActiveKey }
            : {}),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_CONFLICT,
          message: 'Yêu cầu bảo hành đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.warrantyClaimHistory.create({
        data: {
          id: createId(),
          claimId: input.claimId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          action: input.action,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadClaimOrThrow(tx, input.claimId);
      return mapClaim(row);
    });
  }

  async attachClaimMedia(
    claimId: string,
    mediaId: string,
    kind: WarrantyClaimMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<WarrantyClaimRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadClaimOrThrow(tx, claimId);
      const claim = mapClaim(current);

      if (claim.media.some((m) => m.mediaId === mediaId && !m.deletedAt)) {
        return claim;
      }
      const active = claim.media.filter((m) => !m.deletedAt);
      if (active.length >= 5) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT,
          message: 'Tối đa 5 ảnh minh chứng',
        });
      }

      await tx.warrantyClaimMedia.create({
        data: { id: createId(), claimId, mediaId, kind },
      });
      await tx.warrantyClaim.update({
        where: { id: claimId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });
      await insertOutbox(tx, outbox);

      const row = await loadClaimOrThrow(tx, claimId);
      return mapClaim(row);
    });
  }

  async listClaims(filter: ListClaimsFilter): Promise<ListClaimsResult> {
    const where = buildListClaimsWhere(filter);
    const orderBy: Prisma.WarrantyClaimOrderByWithRelationInput = {
      createdAt: filter.sort === 'oldest' ? 'asc' : 'desc',
    };
    const skip = (filter.page - 1) * filter.pageSize;

    const [rows, totalItems] = await Promise.all([
      this.prisma.warrantyClaim.findMany({
        where,
        orderBy,
        skip,
        take: filter.pageSize,
        include: CLAIM_INCLUDE,
      }),
      this.prisma.warrantyClaim.count({ where }),
    ]);

    return { items: rows.map(mapClaim), totalItems };
  }

  /** ---------- returns ---------- */

  async createReturn(input: CreateReturnInput): Promise<ReturnRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const byActiveKey = await tx.returnRequest.findUnique({
        where: { activeKey: input.activeKey },
      });
      if (byActiveKey) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
          message: 'Bạn đã có yêu cầu đổi trả đang xử lý cho mục đơn hàng này',
          details: { orderItemId: input.orderItemId },
        });
      }

      const id = createId();
      const mediaRows = (input.media ?? []).map((m) => ({
        id: createId(),
        mediaId: m.mediaId,
        kind: m.kind,
      }));

      try {
        await tx.returnRequest.create({
          data: {
            id,
            returnCode: input.returnCode,
            orderId: input.orderId,
            orderCode: input.orderCode,
            orderItemId: input.orderItemId,
            customerId: input.customerId,
            productId: input.productId,
            skuId: input.skuId,
            skuCode: input.skuCode,
            productName: input.productName,
            reason: input.reason,
            description: input.description,
            quantity: input.quantity,
            desiredResolution: input.desiredResolution,
            status: 'REQUESTED',
            activeKey: input.activeKey,
            media: { create: mediaRows },
            history: {
              create: {
                id: createId(),
                toStatus: 'REQUESTED',
                action: 'create',
                actorId: input.customerId,
                actorType: 'customer',
              },
            },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError({
            errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
            message:
              'Bạn đã có yêu cầu đổi trả đang xử lý cho mục đơn hàng này',
            details: { orderItemId: input.orderItemId },
          });
        }
        throw error;
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

      const row = await loadReturnOrThrow(tx, id);
      return mapReturn(row);
    });
  }

  async findReturnById(id: string): Promise<ReturnRequestRecord | null> {
    const row = await loadReturn(this.prisma, id);
    return row ? mapReturn(row) : null;
  }

  async findActiveReturnByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReturnRequestRecord | null> {
    const row = await this.prisma.returnRequest.findFirst({
      where: {
        customerId,
        orderItemId,
        activeKey: `${customerId}:${orderItemId}`,
      },
      include: RETURN_INCLUDE,
    });
    return row ? mapReturn(row) : null;
  }

  async transitionReturn(
    input: TransitionReturnInput,
  ): Promise<ReturnRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReturnOrThrow(tx, input.returnId);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_CONFLICT,
          message: 'Yêu cầu đổi trả đã được cập nhật bởi thao tác khác',
        });
      }
      if (current.status !== input.fromStatus) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
          message: 'Trạng thái yêu cầu đổi trả không khớp',
          details: { expected: input.fromStatus, actual: current.status },
        });
      }

      const where: Prisma.ReturnRequestWhereInput = {
        id: input.returnId,
        status: input.fromStatus,
      };
      if (input.expectedVersion !== undefined) {
        where.version = input.expectedVersion;
      }

      const updated = await tx.returnRequest.updateMany({
        where,
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          updatedAt: new Date(),
          ...(input.rotateActiveKey
            ? { activeKey: input.rotateActiveKey }
            : {}),
          ...(input.orderSync
            ? {
                orderSyncedStatus: input.orderSync.status,
                orderSyncedAt: input.orderSync.syncedAt,
              }
            : {}),
        },
      });
      if (updated.count !== 1) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_CONFLICT,
          message: 'Yêu cầu đổi trả đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.returnRequestHistory.create({
        data: {
          id: createId(),
          returnId: input.returnId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          action: input.action,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });

      await insertOutbox(tx, input.outbox);
      if (input.audit) {
        await insertAudit(
          tx,
          input.audit.action,
          input.audit.actorId,
          input.audit.details,
        );
      }

      const row = await loadReturnOrThrow(tx, input.returnId);
      return mapReturn(row);
    });
  }

  async attachReturnMedia(
    returnId: string,
    mediaId: string,
    kind: ReturnRequestMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<ReturnRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await loadReturnOrThrow(tx, returnId);
      const returnRequest = mapReturn(current);

      if (
        returnRequest.media.some((m) => m.mediaId === mediaId && !m.deletedAt)
      ) {
        return returnRequest;
      }
      const active = returnRequest.media.filter((m) => !m.deletedAt);
      if (active.length >= 5) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT,
          message: 'Tối đa 5 ảnh minh chứng',
        });
      }

      await tx.returnRequestMedia.create({
        data: { id: createId(), returnId, mediaId, kind },
      });
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });
      await insertOutbox(tx, outbox);

      const row = await loadReturnOrThrow(tx, returnId);
      return mapReturn(row);
    });
  }

  async listReturns(filter: ListReturnsFilter): Promise<ListReturnsResult> {
    const where = buildListReturnsWhere(filter);
    const orderBy: Prisma.ReturnRequestOrderByWithRelationInput = {
      createdAt: filter.sort === 'oldest' ? 'asc' : 'desc',
    };
    const skip = (filter.page - 1) * filter.pageSize;

    const [rows, totalItems] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        orderBy,
        skip,
        take: filter.pageSize,
        include: RETURN_INCLUDE,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return { items: rows.map(mapReturn), totalItems };
  }

  /** ---------- common ---------- */

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.warrantyIdempotency.findUnique({
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
      await this.prisma.warrantyIdempotency.create({
        data: {
          key,
          operation,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          errorCode: ErrorCodes.WARRANTY_IDEMPOTENCY_CONFLICT,
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
