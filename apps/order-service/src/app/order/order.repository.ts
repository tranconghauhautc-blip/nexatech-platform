import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  AuditLogEntry,
  CreateOrderWithRelationsInput,
  IdempotencyRecord,
  ListOrdersFilter,
  ListOrdersResult,
  Order,
  OrderPackage,
  OrderStatusHistoryEntry,
  OutboxEventInput,
  OutboxEventRecord,
  UpdateOrderStatusInput,
} from './order.types';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  createOrderWithRelations(
    input: CreateOrderWithRelationsInput,
  ): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByCode(orderCode: string): Promise<Order | null>;
  list(filter: ListOrdersFilter): Promise<ListOrdersResult>;
  updateStatus(input: UpdateOrderStatusInput): Promise<Order>;
  markInventoryReleased(
    orderId: string,
    expectedVersion: number,
  ): Promise<Order>;
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
  getStatusHistory(orderId: string): Promise<OrderStatusHistoryEntry[]>;
  getPackages(orderId: string): Promise<OrderPackage[]>;
}

function cloneOrder(order: Order): Order {
  return {
    ...order,
    paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
    cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : undefined,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    items: order.items.map((item) => ({
      ...item,
      variantAttributes: { ...item.variantAttributes },
    })),
    address: order.address ? { ...order.address } : undefined,
    packages: order.packages.map((pkg) => ({
      ...pkg,
      estimatedDeliveryAt: pkg.estimatedDeliveryAt
        ? new Date(pkg.estimatedDeliveryAt)
        : undefined,
      createdAt: new Date(pkg.createdAt),
      updatedAt: new Date(pkg.updatedAt),
      items: pkg.items.map((item) => ({ ...item })),
    })),
  };
}

function assertVersion(order: Order, expectedVersion: number): void {
  if (order.version !== expectedVersion) {
    throw new AppError({
      errorCode: ErrorCodes.ORDER_CONFLICT,
      message: 'Đơn hàng đã được cập nhật bởi thao tác khác',
      details: { expectedVersion, actualVersion: order.version },
    });
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>();
  private history = new Map<string, OrderStatusHistoryEntry[]>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private outbox = new Map<string, OutboxEventRecord>();
  private audits: AuditLogEntry[] = [];

  async createOrderWithRelations(
    input: CreateOrderWithRelationsInput,
  ): Promise<Order> {
    const now = new Date();

    const items = input.items.map((item) => ({
      id: createId(),
      orderId: input.id,
      ...item,
      variantAttributes: { ...item.variantAttributes },
    }));

    const skuCodeToItemId = new Map(items.map((i) => [i.skuCode, i.id]));

    const address = input.address
      ? {
          id: createId(),
          orderId: input.id,
          ...input.address,
        }
      : undefined;

    const packages = input.packages.map((pkg) => ({
      id: createId(),
      orderId: input.id,
      packageCode: pkg.packageCode,
      status: pkg.status,
      sourceLocationType: pkg.sourceLocationType,
      sourceLocationId: pkg.sourceLocationId,
      shippingProvider: undefined,
      trackingCode: undefined,
      estimatedDeliveryAt: undefined,
      createdAt: now,
      updatedAt: now,
      items: pkg.items.map((pkgItem) => ({
        id: createId(),
        packageId: '',
        orderItemId: skuCodeToItemId.get(pkgItem.skuCode) ?? '',
        skuCode: pkgItem.skuCode,
        quantity: pkgItem.quantity,
      })),
    }));
    for (const pkg of packages) {
      for (const item of pkg.items) {
        item.packageId = pkg.id;
      }
    }

    const order: Order = {
      id: input.id,
      orderCode: input.orderCode,
      customerId: input.customerId,
      customerDisplayName: input.customerDisplayName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      status: input.status,
      version: 0,
      cartId: input.cartId,
      reservationId: input.reservationId,
      deliveryMethod: input.deliveryMethod,
      deliverySlot: input.deliverySlot,
      pickupStoreId: input.pickupStoreId,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      paymentReference: undefined,
      paidAt: undefined,
      currency: input.currency,
      merchandiseSubtotal: input.merchandiseSubtotal,
      shippingFee: input.shippingFee,
      discountTotal: input.discountTotal,
      grandTotal: input.grandTotal,
      totalQuantity: input.totalQuantity,
      cancelReason: undefined,
      cancelledAt: undefined,
      inventoryReleased: false,
      refundContractStatus: undefined,
      createdAt: now,
      updatedAt: now,
      items,
      address,
      packages,
    };
    this.orders.set(order.id, order);

    this.history.set(order.id, [
      {
        id: createId(),
        orderId: order.id,
        fromStatus: undefined,
        toStatus: order.status,
        actorId: input.actorId,
        actorType: input.actorType,
        reason: undefined,
        createdAt: now,
      },
    ]);

    await this.addOutbox(input.outboxEvents);

    return cloneOrder(order);
  }

  async findById(id: string): Promise<Order | null> {
    const order = this.orders.get(id);
    return order ? cloneOrder(order) : null;
  }

  async findByCode(orderCode: string): Promise<Order | null> {
    const order = [...this.orders.values()].find(
      (o) => o.orderCode === orderCode,
    );
    return order ? cloneOrder(order) : null;
  }

  async list(filter: ListOrdersFilter): Promise<ListOrdersResult> {
    let items = [...this.orders.values()];
    if (filter.customerId) {
      items = items.filter((o) => o.customerId === filter.customerId);
    }
    if (filter.status) {
      items = items.filter((o) => o.status === filter.status);
    }
    if (filter.orderCode) {
      items = items.filter((o) => o.orderCode === filter.orderCode);
    }
    if (filter.from) {
      const from = filter.from;
      items = items.filter((o) => o.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((o) => o.createdAt <= to);
    }

    const [sortField, sortDir] = filter.sort.split('_') as [
      'createdAt' | 'grandTotal',
      'asc' | 'desc',
    ];
    items = items.sort((a, b) => {
      const av =
        sortField === 'createdAt' ? a.createdAt.getTime() : a.grandTotal;
      const bv =
        sortField === 'createdAt' ? b.createdAt.getTime() : b.grandTotal;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items.slice(start, start + filter.pageSize).map(cloneOrder);
    return { items: page, total };
  }

  async updateStatus(input: UpdateOrderStatusInput): Promise<Order> {
    const order = this.orders.get(input.orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
        message: 'Không tìm thấy đơn hàng',
      });
    }
    assertVersion(order, input.expectedVersion);

    const fromStatus = order.status;
    order.status = input.toStatus;
    order.version += 1;
    order.updatedAt = new Date();
    if (input.paymentStatus !== undefined) {
      order.paymentStatus = input.paymentStatus;
    }
    if (input.paymentReference !== undefined) {
      order.paymentReference = input.paymentReference;
    }
    if (input.paidAt !== undefined) {
      order.paidAt = input.paidAt ?? undefined;
    }
    if (input.cancelReason !== undefined) {
      order.cancelReason = input.cancelReason;
    }
    if (input.cancelledAt !== undefined) {
      order.cancelledAt = input.cancelledAt;
    }
    if (input.inventoryReleased !== undefined) {
      order.inventoryReleased = input.inventoryReleased;
    }
    if (input.refundContractStatus !== undefined) {
      order.refundContractStatus = input.refundContractStatus;
    }

    const entries = this.history.get(order.id) ?? [];
    entries.push({
      id: createId(),
      orderId: order.id,
      fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: order.updatedAt,
    });
    this.history.set(order.id, entries);

    if (input.outboxEvents?.length) {
      await this.addOutbox(input.outboxEvents);
    }

    return cloneOrder(order);
  }

  async markInventoryReleased(
    orderId: string,
    expectedVersion: number,
  ): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
        message: 'Không tìm thấy đơn hàng',
      });
    }
    assertVersion(order, expectedVersion);
    order.inventoryReleased = true;
    order.version += 1;
    order.updatedAt = new Date();
    return cloneOrder(order);
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    return this.idempotency.get(key) ?? null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    if (this.idempotency.has(key)) {
      return;
    }
    this.idempotency.set(key, {
      key,
      operation,
      responseJson: response,
      createdAt: new Date(),
    });
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    for (const event of events) {
      const id = createId();
      this.outbox.set(id, {
        id,
        eventType: event.eventType,
        routingKey: event.routingKey,
        payload: event.payload,
        traceId: event.traceId,
        publishedAt: undefined,
        createdAt: new Date(),
      });
    }
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    return [...this.outbox.values()]
      .filter((e) => !e.publishedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const event = this.outbox.get(id);
      if (event) {
        event.publishedAt = now;
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

  async getStatusHistory(orderId: string): Promise<OrderStatusHistoryEntry[]> {
    return (this.history.get(orderId) ?? []).map((h) => ({ ...h }));
  }

  async getPackages(orderId: string): Promise<OrderPackage[]> {
    const order = this.orders.get(orderId);
    if (!order) {
      return [];
    }
    return order.packages.map((pkg) => ({
      ...pkg,
      items: pkg.items.map((item) => ({ ...item })),
    }));
  }
}
