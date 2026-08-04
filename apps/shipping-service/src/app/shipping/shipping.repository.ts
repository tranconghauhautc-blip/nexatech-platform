import { createHash } from 'node:crypto';
import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  AuditLogEntry,
  CreateCallbackInput,
  CreateQuoteInput,
  CreateShipmentInput,
  CreateSlotInput,
  DeliverySlot,
  IdempotencyRecord,
  ListShipmentsFilter,
  ListShipmentsResult,
  ListSlotsFilter,
  OutboxEventInput,
  OutboxEventRecord,
  ProviderCallback,
  ReserveSlotInput,
  Shipment,
  ShippingQuote,
  SlotReservation,
  UpdateShipmentStatusInput,
} from './shipping.types';

export const SHIPPING_REPOSITORY = Symbol('SHIPPING_REPOSITORY');

export interface ShippingRepository {
  createQuote(input: CreateQuoteInput): Promise<ShippingQuote>;
  findQuoteById(id: string): Promise<ShippingQuote | null>;
  createSlot(input: CreateSlotInput): Promise<DeliverySlot>;
  findSlotById(id: string): Promise<DeliverySlot | null>;
  listSlots(filter: ListSlotsFilter): Promise<DeliverySlot[]>;
  reserveSlot(input: ReserveSlotInput): Promise<SlotReservation>;
  findReservationById(id: string): Promise<SlotReservation | null>;
  findReservationByIdempotency(key: string): Promise<SlotReservation | null>;
  releaseReservation(id: string, actorId: string): Promise<SlotReservation>;
  createShipment(input: CreateShipmentInput): Promise<Shipment>;
  findShipmentById(id: string): Promise<Shipment | null>;
  findShipmentByPackageId(packageId: string): Promise<Shipment | null>;
  findShipmentByTrackingCode(trackingCode: string): Promise<Shipment | null>;
  findShipmentsByOrderId(orderId: string): Promise<Shipment[]>;
  updateShipmentStatus(input: UpdateShipmentStatusInput): Promise<Shipment>;
  markOrderSynced(
    shipmentId: string,
    expectedVersion: number,
    orderSyncedAt: Date,
  ): Promise<Shipment>;
  listShipments(filter: ListShipmentsFilter): Promise<ListShipmentsResult>;
  recordCallback(input: CreateCallbackInput): Promise<ProviderCallback>;
  findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<ProviderCallback | null>;
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

export function hashCallbackPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function cloneQuote(q: ShippingQuote): ShippingQuote {
  return {
    ...q,
    packageFees: q.packageFees.map((p) => ({ ...p })),
    snapshotJson: { ...q.snapshotJson },
    expiresAt: new Date(q.expiresAt),
    createdAt: new Date(q.createdAt),
    updatedAt: new Date(q.updatedAt),
  };
}

function cloneSlot(s: DeliverySlot): DeliverySlot {
  return {
    ...s,
    deliveryDate: new Date(s.deliveryDate),
    cutoffAt: new Date(s.cutoffAt),
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

function cloneReservation(r: SlotReservation): SlotReservation {
  return {
    ...r,
    expiresAt: new Date(r.expiresAt),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}

function cloneShipment(s: Shipment): Shipment {
  return {
    ...s,
    destinationJson: s.destinationJson ? { ...s.destinationJson } : undefined,
    estimatedDeliveryAt: s.estimatedDeliveryAt
      ? new Date(s.estimatedDeliveryAt)
      : undefined,
    orderSyncedAt: s.orderSyncedAt ? new Date(s.orderSyncedAt) : undefined,
    stockCommittedAt: s.stockCommittedAt
      ? new Date(s.stockCommittedAt)
      : undefined,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    items: s.items.map((i) => ({ ...i, createdAt: new Date(i.createdAt) })),
    history: s.history.map((h) => ({ ...h, createdAt: new Date(h.createdAt) })),
    tracking: s.tracking.map((t) => ({
      ...t,
      eventTime: new Date(t.eventTime),
      createdAt: new Date(t.createdAt),
    })),
  };
}

export class InMemoryShippingRepository implements ShippingRepository {
  private quotes = new Map<string, ShippingQuote>();
  private slots = new Map<string, DeliverySlot>();
  private reservations = new Map<string, SlotReservation>();
  private reservationByIdem = new Map<string, string>();
  private shipments = new Map<string, Shipment>();
  private byPackage = new Map<string, string>();
  private byTracking = new Map<string, string>();
  private callbacks = new Map<string, ProviderCallback>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private outbox = new Map<string, OutboxEventRecord>();
  private audits: AuditLogEntry[] = [];

  async createQuote(input: CreateQuoteInput): Promise<ShippingQuote> {
    const now = new Date();
    const quote: ShippingQuote = {
      id: input.id,
      orderId: input.orderId,
      orderCode: input.orderCode,
      customerId: input.customerId,
      deliveryMethod: input.deliveryMethod,
      currency: 'VND',
      totalFee: input.totalFee,
      packageFees: input.packageFees.map((p) => ({ ...p })),
      provider: input.provider,
      expiresAt: input.expiresAt,
      snapshotJson: { ...input.snapshotJson },
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.quotes.set(quote.id, quote);
    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('shipping.quote.create', input.actorId, {
      quoteId: quote.id,
    });
    return cloneQuote(quote);
  }

  async findQuoteById(id: string): Promise<ShippingQuote | null> {
    const q = this.quotes.get(id);
    return q ? cloneQuote(q) : null;
  }

  async createSlot(input: CreateSlotInput): Promise<DeliverySlot> {
    const now = new Date();
    const slot: DeliverySlot = {
      id: input.id,
      deliveryDate: input.deliveryDate,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      deliveryMethod: input.deliveryMethod,
      locationType: input.locationType,
      locationId: input.locationId,
      capacity: input.capacity,
      reservedCount: 0,
      cutoffAt: input.cutoffAt,
      timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
      active: true,
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.slots.set(slot.id, slot);
    return cloneSlot(slot);
  }

  async findSlotById(id: string): Promise<DeliverySlot | null> {
    const s = this.slots.get(id);
    return s ? cloneSlot(s) : null;
  }

  async listSlots(filter: ListSlotsFilter): Promise<DeliverySlot[]> {
    let items = [...this.slots.values()].filter((s) => s.active);
    if (filter.deliveryMethod)
      items = items.filter((s) => s.deliveryMethod === filter.deliveryMethod);
    if (filter.locationType)
      items = items.filter((s) => s.locationType === filter.locationType);
    if (filter.locationId)
      items = items.filter((s) => s.locationId === filter.locationId);
    if (filter.deliveryDate) {
      const d = filter.deliveryDate.toISOString().slice(0, 10);
      items = items.filter(
        (s) => s.deliveryDate.toISOString().slice(0, 10) === d,
      );
    }
    if (filter.onlyAvailable) {
      const now = new Date();
      items = items.filter(
        (s) => s.reservedCount < s.capacity && s.cutoffAt > now,
      );
    }
    return items.map(cloneSlot);
  }

  async reserveSlot(input: ReserveSlotInput): Promise<SlotReservation> {
    const existingId = this.reservationByIdem.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.reservations.get(existingId);
      if (existing) return cloneReservation(existing);
    }

    const slot = this.slots.get(input.slotId);
    if (!slot || !slot.active) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SLOT_UNAVAILABLE,
        message: 'Slot giao hàng không khả dụng',
      });
    }
    if (slot.version !== input.expectedSlotVersion) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CONFLICT,
        message: 'Slot đã được cập nhật bởi thao tác khác',
        details: {
          expectedVersion: input.expectedSlotVersion,
          actualVersion: slot.version,
        },
      });
    }
    if (slot.cutoffAt.getTime() <= Date.now()) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SLOT_EXPIRED,
        message: 'Slot đã quá hạn đặt chỗ',
      });
    }
    if (slot.reservedCount >= slot.capacity) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SLOT_CAPACITY,
        message: 'Slot đã hết chỗ',
        details: { capacity: slot.capacity, reservedCount: slot.reservedCount },
      });
    }

    slot.reservedCount += 1;
    slot.version += 1;
    slot.updatedAt = new Date();

    const now = new Date();
    const reservation: SlotReservation = {
      id: input.id,
      slotId: input.slotId,
      orderId: input.orderId,
      customerId: input.customerId,
      status: 'HELD',
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.reservations.set(reservation.id, reservation);
    this.reservationByIdem.set(input.idempotencyKey, reservation.id);
    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('shipping.slot.reserve', input.actorId, {
      reservationId: reservation.id,
    });
    return cloneReservation(reservation);
  }

  async findReservationById(id: string): Promise<SlotReservation | null> {
    const r = this.reservations.get(id);
    return r ? cloneReservation(r) : null;
  }

  async findReservationByIdempotency(
    key: string,
  ): Promise<SlotReservation | null> {
    const id = this.reservationByIdem.get(key);
    return id ? this.findReservationById(id) : null;
  }

  async releaseReservation(
    id: string,
    actorId: string,
  ): Promise<SlotReservation> {
    const reservation = this.reservations.get(id);
    if (!reservation) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
        message: 'Không tìm thấy đặt chỗ slot',
      });
    }
    if (reservation.status === 'HELD') {
      reservation.status = 'RELEASED';
      reservation.updatedAt = new Date();
      const slot = this.slots.get(reservation.slotId);
      if (slot && slot.reservedCount > 0) {
        slot.reservedCount -= 1;
        slot.version += 1;
        slot.updatedAt = new Date();
      }
    }
    await this.writeAudit('shipping.slot.release', actorId, {
      reservationId: id,
    });
    return cloneReservation(reservation);
  }

  async createShipment(input: CreateShipmentInput): Promise<Shipment> {
    if (this.byPackage.has(input.packageId)) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_ALREADY_EXISTS,
        message: 'Kiện hàng đã có shipment',
        details: { packageId: input.packageId },
      });
    }
    const now = new Date();
    const shipment: Shipment = {
      id: input.id,
      orderId: input.orderId,
      orderCode: input.orderCode,
      packageId: input.packageId,
      customerId: input.customerId,
      deliveryMethod: input.deliveryMethod,
      provider: input.provider,
      status: input.status,
      sourceLocationType: input.sourceLocationType,
      sourceLocationId: input.sourceLocationId,
      destinationJson: input.destinationJson,
      shippingFee: input.shippingFee,
      currency: input.currency,
      quoteId: input.quoteId,
      slotReservationId: input.slotReservationId,
      providerShipmentRef: input.providerShipmentRef,
      trackingCode: input.trackingCode,
      estimatedDeliveryAt: input.estimatedDeliveryAt,
      failureAttempts: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
      items: input.items.map((item) => ({
        id: createId(),
        shipmentId: input.id,
        skuCode: item.skuCode,
        quantity: item.quantity,
        orderItemId: item.orderItemId,
        createdAt: now,
      })),
      history: [
        {
          id: createId(),
          shipmentId: input.id,
          fromStatus: undefined,
          toStatus: input.status,
          actorId: input.actorId,
          actorType: input.actorType,
          createdAt: now,
        },
      ],
      tracking: [],
    };
    this.shipments.set(shipment.id, shipment);
    this.byPackage.set(shipment.packageId, shipment.id);
    if (shipment.trackingCode)
      this.byTracking.set(shipment.trackingCode, shipment.id);
    if (input.quoteId) {
      const quote = this.quotes.get(input.quoteId);
      if (quote) {
        quote.status = 'CONSUMED';
        quote.updatedAt = now;
      }
    }
    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('shipping.shipment.create', input.actorId, {
      shipmentId: shipment.id,
    });
    return cloneShipment(shipment);
  }

  async findShipmentById(id: string): Promise<Shipment | null> {
    const s = this.shipments.get(id);
    return s ? cloneShipment(s) : null;
  }

  async findShipmentByPackageId(packageId: string): Promise<Shipment | null> {
    const id = this.byPackage.get(packageId);
    return id ? this.findShipmentById(id) : null;
  }

  async findShipmentByTrackingCode(
    trackingCode: string,
  ): Promise<Shipment | null> {
    const id = this.byTracking.get(trackingCode);
    return id ? this.findShipmentById(id) : null;
  }

  async findShipmentsByOrderId(orderId: string): Promise<Shipment[]> {
    return [...this.shipments.values()]
      .filter((s) => s.orderId === orderId)
      .map(cloneShipment);
  }

  async updateShipmentStatus(
    input: UpdateShipmentStatusInput,
  ): Promise<Shipment> {
    const shipment = this.shipments.get(input.shipmentId);
    if (!shipment) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
        message: 'Không tìm thấy shipment',
      });
    }
    if (shipment.version !== input.expectedVersion) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CONFLICT,
        message: 'Shipment đã được cập nhật bởi thao tác khác',
        details: {
          expectedVersion: input.expectedVersion,
          actualVersion: shipment.version,
        },
      });
    }

    const fromStatus = shipment.status;
    shipment.status = input.status;
    shipment.version += 1;
    shipment.updatedAt = new Date();
    // Status change invalidates prior order sync stamp so DELIVERED can
    // re-sync after READY_FOR_PICKUP / IN_TRANSIT intermediate syncs.
    if (fromStatus !== input.status && input.orderSyncedAt === undefined) {
      shipment.orderSyncedAt = undefined;
    }
    if (input.providerShipmentRef !== undefined)
      shipment.providerShipmentRef = input.providerShipmentRef;
    if (input.trackingCode !== undefined) {
      if (shipment.trackingCode) this.byTracking.delete(shipment.trackingCode);
      shipment.trackingCode = input.trackingCode;
      this.byTracking.set(input.trackingCode, shipment.id);
    }
    if (input.estimatedDeliveryAt !== undefined)
      shipment.estimatedDeliveryAt = input.estimatedDeliveryAt;
    if (input.pickupCodeHash !== undefined)
      shipment.pickupCodeHash = input.pickupCodeHash;
    if (input.pickupCodeHint !== undefined)
      shipment.pickupCodeHint = input.pickupCodeHint;
    if (input.orderSyncedAt !== undefined)
      shipment.orderSyncedAt = input.orderSyncedAt;
    if (input.stockCommittedAt !== undefined)
      shipment.stockCommittedAt = input.stockCommittedAt;
    if (input.failureAttempts !== undefined)
      shipment.failureAttempts = input.failureAttempts;

    shipment.history.push({
      id: createId(),
      shipmentId: shipment.id,
      fromStatus,
      toStatus: input.status,
      actorId: input.actorId,
      actorType: input.actorType,
      reason: input.reason,
      createdAt: new Date(),
    });

    if (input.trackingEvent) {
      shipment.tracking.push({
        id: createId(),
        shipmentId: shipment.id,
        providerStatus: input.trackingEvent.providerStatus,
        normalizedStatus: input.trackingEvent.normalizedStatus,
        eventTime: input.trackingEvent.eventTime,
        locationText: input.trackingEvent.locationText,
        note: input.trackingEvent.note,
        source: input.trackingEvent.source,
        createdAt: new Date(),
      });
    }

    if (input.consumeSlotReservationId) {
      const reservation = this.reservations.get(input.consumeSlotReservationId);
      if (reservation && reservation.status === 'HELD') {
        reservation.status = 'CONSUMED';
        reservation.shipmentId = shipment.id;
        reservation.updatedAt = new Date();
      }
    }
    if (input.releaseSlotReservationId) {
      await this.releaseReservation(
        input.releaseSlotReservationId,
        input.actorId,
      );
    }

    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('shipping.shipment.status_update', input.actorId, {
      shipmentId: shipment.id,
      status: input.status,
    });
    return cloneShipment(shipment);
  }

  async markOrderSynced(
    shipmentId: string,
    expectedVersion: number,
    orderSyncedAt: Date,
  ): Promise<Shipment> {
    const shipment = this.shipments.get(shipmentId);
    if (!shipment) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
        message: 'Không tìm thấy shipment',
      });
    }
    if (shipment.version !== expectedVersion) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CONFLICT,
        message: 'Shipment đã được cập nhật bởi thao tác khác',
      });
    }
    shipment.orderSyncedAt = orderSyncedAt;
    shipment.version += 1;
    shipment.updatedAt = new Date();
    return cloneShipment(shipment);
  }
  async listShipments(
    filter: ListShipmentsFilter,
  ): Promise<ListShipmentsResult> {
    let items = [...this.shipments.values()];
    if (filter.status) items = items.filter((s) => s.status === filter.status);
    if (filter.provider)
      items = items.filter((s) => s.provider === filter.provider);
    if (filter.orderId)
      items = items.filter((s) => s.orderId === filter.orderId);
    if (filter.customerId)
      items = items.filter((s) => s.customerId === filter.customerId);
    if (filter.packageId)
      items = items.filter((s) => s.packageId === filter.packageId);
    if (filter.from) {
      const from = filter.from;
      items = items.filter((s) => s.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((s) => s.createdAt <= to);
    }
    const desc = !filter.sort.endsWith('_asc');
    if (filter.sort.startsWith('shippingFee')) {
      items.sort((a, b) =>
        desc ? b.shippingFee - a.shippingFee : a.shippingFee - b.shippingFee,
      );
    } else {
      items.sort((a, b) =>
        desc
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const pageItems = items
      .slice(start, start + filter.pageSize)
      .map(cloneShipment);
    return {
      items: pageItems,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async recordCallback(input: CreateCallbackInput): Promise<ProviderCallback> {
    const key = `${input.provider}:${input.payloadHash}`;
    const existing = this.callbacks.get(key);
    if (existing)
      return { ...existing, createdAt: new Date(existing.createdAt) };
    const cb: ProviderCallback = {
      id: createId(),
      provider: input.provider,
      payloadHash: input.payloadHash,
      signatureValid: input.signatureValid,
      rawPayloadJson: { ...input.rawPayloadJson },
      processed: input.processed,
      resultStatus: input.resultStatus,
      shipmentId: input.shipmentId,
      createdAt: new Date(),
    };
    this.callbacks.set(key, cb);
    return { ...cb };
  }

  async findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<ProviderCallback | null> {
    const cb = this.callbacks.get(`${provider}:${payloadHash}`);
    return cb ? { ...cb, createdAt: new Date(cb.createdAt) } : null;
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    return this.idempotency.get(key) ?? null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    if (this.idempotency.has(key)) return;
    this.idempotency.set(key, {
      key,
      operation,
      response,
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
      .slice(0, limit)
      .map((e) => ({
        ...e,
        payload: { ...e.payload },
        createdAt: new Date(e.createdAt),
      }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const event = this.outbox.get(id);
      if (event) event.publishedAt = now;
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
