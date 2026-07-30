import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
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

export const WARRANTY_REPOSITORY = Symbol('WARRANTY_REPOSITORY');

export interface WarrantyRepository {
  // claims
  createClaim(input: CreateClaimInput): Promise<WarrantyClaimRecord>;
  findClaimById(id: string): Promise<WarrantyClaimRecord | null>;
  findActiveClaimByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<WarrantyClaimRecord | null>;
  transitionClaim(input: TransitionClaimInput): Promise<WarrantyClaimRecord>;
  attachClaimMedia(
    claimId: string,
    mediaId: string,
    kind: WarrantyClaimMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<WarrantyClaimRecord>;
  listClaims(filter: ListClaimsFilter): Promise<ListClaimsResult>;

  // returns
  createReturn(input: CreateReturnInput): Promise<ReturnRequestRecord>;
  findReturnById(id: string): Promise<ReturnRequestRecord | null>;
  findActiveReturnByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReturnRequestRecord | null>;
  transitionReturn(input: TransitionReturnInput): Promise<ReturnRequestRecord>;
  attachReturnMedia(
    returnId: string,
    mediaId: string,
    kind: ReturnRequestMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<ReturnRequestRecord>;
  listReturns(filter: ListReturnsFilter): Promise<ListReturnsResult>;

  // common
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

function cloneClaim(r: WarrantyClaimRecord): WarrantyClaimRecord {
  return {
    ...r,
    orderSyncedAt: r.orderSyncedAt ? new Date(r.orderSyncedAt) : undefined,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    media: r.media.map((m) => ({
      ...m,
      deletedAt: m.deletedAt ? new Date(m.deletedAt) : undefined,
      createdAt: new Date(m.createdAt),
    })),
    history: r.history.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })),
  };
}

function cloneReturn(r: ReturnRequestRecord): ReturnRequestRecord {
  return {
    ...r,
    orderSyncedAt: r.orderSyncedAt ? new Date(r.orderSyncedAt) : undefined,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    media: r.media.map((m) => ({
      ...m,
      deletedAt: m.deletedAt ? new Date(m.deletedAt) : undefined,
      createdAt: new Date(m.createdAt),
    })),
    history: r.history.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })),
  };
}

export class InMemoryWarrantyRepository implements WarrantyRepository {
  private claims = new Map<string, WarrantyClaimRecord>();
  private returns = new Map<string, ReturnRequestRecord>();
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
    this.claims.clear();
    this.returns.clear();
    this.idempotency.clear();
    this.outbox = [];
    this.audits = [];
  }

  /** ---------- claims ---------- */

  async createClaim(input: CreateClaimInput): Promise<WarrantyClaimRecord> {
    const existingActiveKey = [...this.claims.values()].find(
      (c) => c.activeKey === input.activeKey,
    );
    if (existingActiveKey) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
        message: 'Bạn đã có yêu cầu bảo hành đang xử lý cho mục đơn hàng này',
        details: { orderItemId: input.orderItemId },
      });
    }
    const now = new Date();
    const id = createId();
    const media: WarrantyClaimMediaRecord[] = (input.media ?? []).map((m) => ({
      id: createId(),
      claimId: id,
      mediaId: m.mediaId,
      kind: m.kind,
      createdAt: now,
    }));
    const claim: WarrantyClaimRecord = {
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
      version: 0,
      createdAt: now,
      updatedAt: now,
      media,
      history: [
        {
          id: createId(),
          claimId: id,
          toStatus: 'SUBMITTED',
          action: 'create',
          actorId: input.customerId,
          actorType: 'customer',
          createdAt: now,
        },
      ],
    };
    this.claims.set(id, claim);
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneClaim(claim);
  }

  async findClaimById(id: string): Promise<WarrantyClaimRecord | null> {
    const c = this.claims.get(id);
    return c ? cloneClaim(c) : null;
  }

  async findActiveClaimByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<WarrantyClaimRecord | null> {
    const found = [...this.claims.values()].find(
      (c) =>
        c.customerId === customerId &&
        c.orderItemId === orderItemId &&
        c.activeKey === `${customerId}:${orderItemId}`,
    );
    return found ? cloneClaim(found) : null;
  }

  async transitionClaim(
    input: TransitionClaimInput,
  ): Promise<WarrantyClaimRecord> {
    const claim = this.claims.get(input.claimId);
    if (!claim) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu bảo hành',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      claim.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_CONFLICT,
        message: 'Yêu cầu bảo hành đã được cập nhật bởi thao tác khác',
      });
    }
    if (claim.status !== input.fromStatus) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
        message: 'Trạng thái yêu cầu bảo hành không khớp',
        details: { expected: input.fromStatus, actual: claim.status },
      });
    }
    const fromStatus = claim.status;
    claim.status = input.toStatus;
    claim.version += 1;
    claim.updatedAt = new Date();
    if (input.rotateActiveKey) {
      claim.activeKey = input.rotateActiveKey;
    }
    claim.history.push({
      id: createId(),
      claimId: claim.id,
      fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: new Date(),
    });
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneClaim(claim);
  }

  async attachClaimMedia(
    claimId: string,
    mediaId: string,
    kind: WarrantyClaimMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<WarrantyClaimRecord> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu bảo hành',
      });
    }
    if (claim.media.some((m) => m.mediaId === mediaId && !m.deletedAt)) {
      return cloneClaim(claim);
    }
    const active = claim.media.filter((m) => !m.deletedAt);
    if (active.length >= 5) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT,
        message: 'Tối đa 5 ảnh minh chứng',
      });
    }
    claim.media.push({
      id: createId(),
      claimId,
      mediaId,
      kind,
      createdAt: new Date(),
    });
    claim.version += 1;
    claim.updatedAt = new Date();
    await this.addOutbox(outbox);
    return cloneClaim(claim);
  }

  async listClaims(filter: ListClaimsFilter): Promise<ListClaimsResult> {
    let items = [...this.claims.values()];
    if (filter.customerId) {
      items = items.filter((c) => c.customerId === filter.customerId);
    }
    if (filter.status) {
      items = items.filter((c) => c.status === filter.status);
    }
    if (filter.orderId) {
      items = items.filter((c) => c.orderId === filter.orderId);
    }
    if (filter.from) {
      const from = filter.from;
      items = items.filter((c) => c.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((c) => c.createdAt <= to);
    }
    items.sort((a, b) =>
      filter.sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map(cloneClaim),
      totalItems,
    };
  }

  /** ---------- returns ---------- */

  async createReturn(input: CreateReturnInput): Promise<ReturnRequestRecord> {
    const existingActiveKey = [...this.returns.values()].find(
      (r) => r.activeKey === input.activeKey,
    );
    if (existingActiveKey) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
        message: 'Bạn đã có yêu cầu đổi trả đang xử lý cho mục đơn hàng này',
        details: { orderItemId: input.orderItemId },
      });
    }
    const now = new Date();
    const id = createId();
    const media: ReturnRequestMediaRecord[] = (input.media ?? []).map((m) => ({
      id: createId(),
      returnId: id,
      mediaId: m.mediaId,
      kind: m.kind,
      createdAt: now,
    }));
    const returnRequest: ReturnRequestRecord = {
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
      version: 0,
      createdAt: now,
      updatedAt: now,
      media,
      history: [
        {
          id: createId(),
          returnId: id,
          toStatus: 'REQUESTED',
          action: 'create',
          actorId: input.customerId,
          actorType: 'customer',
          createdAt: now,
        },
      ],
    };
    this.returns.set(id, returnRequest);
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneReturn(returnRequest);
  }

  async findReturnById(id: string): Promise<ReturnRequestRecord | null> {
    const r = this.returns.get(id);
    return r ? cloneReturn(r) : null;
  }

  async findActiveReturnByCustomerOrderItem(
    customerId: string,
    orderItemId: string,
  ): Promise<ReturnRequestRecord | null> {
    const found = [...this.returns.values()].find(
      (r) =>
        r.customerId === customerId &&
        r.orderItemId === orderItemId &&
        r.activeKey === `${customerId}:${orderItemId}`,
    );
    return found ? cloneReturn(found) : null;
  }

  async transitionReturn(
    input: TransitionReturnInput,
  ): Promise<ReturnRequestRecord> {
    const returnRequest = this.returns.get(input.returnId);
    if (!returnRequest) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu đổi trả',
      });
    }
    if (
      input.expectedVersion !== undefined &&
      returnRequest.version !== input.expectedVersion
    ) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_CONFLICT,
        message: 'Yêu cầu đổi trả đã được cập nhật bởi thao tác khác',
      });
    }
    if (returnRequest.status !== input.fromStatus) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
        message: 'Trạng thái yêu cầu đổi trả không khớp',
        details: { expected: input.fromStatus, actual: returnRequest.status },
      });
    }
    const fromStatus = returnRequest.status;
    returnRequest.status = input.toStatus;
    returnRequest.version += 1;
    returnRequest.updatedAt = new Date();
    if (input.rotateActiveKey) {
      returnRequest.activeKey = input.rotateActiveKey;
    }
    if (input.orderSync) {
      returnRequest.orderSyncedStatus = input.orderSync.status;
      returnRequest.orderSyncedAt = input.orderSync.syncedAt;
    }
    returnRequest.history.push({
      id: createId(),
      returnId: returnRequest.id,
      fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: new Date(),
    });
    await this.addOutbox(input.outbox);
    if (input.audit) {
      await this.writeAudit(
        input.audit.action,
        input.audit.actorId,
        input.audit.details,
      );
    }
    return cloneReturn(returnRequest);
  }

  async attachReturnMedia(
    returnId: string,
    mediaId: string,
    kind: ReturnRequestMediaRecord['kind'],
    outbox: OutboxEventInput[],
  ): Promise<ReturnRequestRecord> {
    const returnRequest = this.returns.get(returnId);
    if (!returnRequest) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu đổi trả',
      });
    }
    if (
      returnRequest.media.some((m) => m.mediaId === mediaId && !m.deletedAt)
    ) {
      return cloneReturn(returnRequest);
    }
    const active = returnRequest.media.filter((m) => !m.deletedAt);
    if (active.length >= 5) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT,
        message: 'Tối đa 5 ảnh minh chứng',
      });
    }
    returnRequest.media.push({
      id: createId(),
      returnId,
      mediaId,
      kind,
      createdAt: new Date(),
    });
    returnRequest.version += 1;
    returnRequest.updatedAt = new Date();
    await this.addOutbox(outbox);
    return cloneReturn(returnRequest);
  }

  async listReturns(filter: ListReturnsFilter): Promise<ListReturnsResult> {
    let items = [...this.returns.values()];
    if (filter.customerId) {
      items = items.filter((r) => r.customerId === filter.customerId);
    }
    if (filter.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter.orderId) {
      items = items.filter((r) => r.orderId === filter.orderId);
    }
    if (filter.from) {
      const from = filter.from;
      items = items.filter((r) => r.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((r) => r.createdAt <= to);
    }
    items.sort((a, b) =>
      filter.sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const totalItems = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: items.slice(start, start + filter.pageSize).map(cloneReturn),
      totalItems,
    };
  }

  /** ---------- common ---------- */

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
        errorCode: ErrorCodes.WARRANTY_IDEMPOTENCY_CONFLICT,
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
