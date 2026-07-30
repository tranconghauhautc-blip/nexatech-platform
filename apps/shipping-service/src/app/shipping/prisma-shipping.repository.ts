import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import type { PrismaService } from './prisma.service';
import type {
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
  PackageFee,
  ProviderCallback,
  ReserveSlotInput,
  Shipment,
  ShipmentItem,
  ShipmentStatusHistory,
  ShippingQuote,
  SlotReservation,
  TrackingEvent,
  UpdateShipmentStatusInput,
} from './shipping.types';
import type { ShippingRepository } from './shipping.repository';

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapOutboxCreateMany(events: OutboxEventInput[]) {
  return events.map((e) => ({
    eventType: e.eventType,
    routingKey: e.routingKey,
    payloadJson: asJson(e.payload),
    traceId: e.traceId,
  }));
}

function mapQuote(row: any): ShippingQuote {
  return {
    id: row.id,
    orderId: row.orderId,
    orderCode: row.orderCode,
    customerId: row.customerId,
    deliveryMethod: row.deliveryMethod,
    currency: row.currency,
    totalFee: row.totalFee,
    packageFees: row.packageFees as PackageFee[],
    provider: row.provider,
    expiresAt: row.expiresAt,
    snapshotJson: row.snapshotJson as Record<string, unknown>,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSlot(row: any): DeliverySlot {
  return {
    id: row.id,
    deliveryDate: row.deliveryDate,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    deliveryMethod: row.deliveryMethod,
    locationType: row.locationType,
    locationId: row.locationId,
    capacity: row.capacity,
    reservedCount: row.reservedCount,
    cutoffAt: row.cutoffAt,
    timezone: row.timezone,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapReservation(row: any): SlotReservation {
  return {
    id: row.id,
    slotId: row.slotId,
    orderId: row.orderId ?? undefined,
    shipmentId: row.shipmentId ?? undefined,
    customerId: row.customerId,
    status: row.status,
    expiresAt: row.expiresAt,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapShipment(row: any): Shipment {
  return {
    id: row.id,
    orderId: row.orderId,
    orderCode: row.orderCode,
    packageId: row.packageId,
    customerId: row.customerId,
    deliveryMethod: row.deliveryMethod,
    provider: row.provider,
    status: row.status,
    sourceLocationType: row.sourceLocationType,
    sourceLocationId: row.sourceLocationId,
    destinationJson:
      (row.destinationJson as Record<string, unknown>) ?? undefined,
    shippingFee: row.shippingFee,
    currency: row.currency,
    quoteId: row.quoteId ?? undefined,
    slotReservationId: row.slotReservationId ?? undefined,
    providerShipmentRef: row.providerShipmentRef ?? undefined,
    trackingCode: row.trackingCode ?? undefined,
    estimatedDeliveryAt: row.estimatedDeliveryAt ?? undefined,
    pickupCodeHash: row.pickupCodeHash ?? undefined,
    pickupCodeHint: row.pickupCodeHint ?? undefined,
    failureAttempts: row.failureAttempts,
    orderSyncedAt: row.orderSyncedAt ?? undefined,
    stockCommittedAt: row.stockCommittedAt ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: (row.items ?? []).map(
      (i: any): ShipmentItem => ({
        id: i.id,
        shipmentId: i.shipmentId,
        skuCode: i.skuCode,
        quantity: i.quantity,
        orderItemId: i.orderItemId ?? undefined,
        createdAt: i.createdAt,
      }),
    ),
    history: (row.history ?? []).map(
      (h: any): ShipmentStatusHistory => ({
        id: h.id,
        shipmentId: h.shipmentId,
        fromStatus: h.fromStatus ?? undefined,
        toStatus: h.toStatus,
        actorId: h.actorId,
        actorType: h.actorType,
        reason: h.reason ?? undefined,
        createdAt: h.createdAt,
      }),
    ),
    tracking: (row.tracking ?? []).map(
      (t: any): TrackingEvent => ({
        id: t.id,
        shipmentId: t.shipmentId,
        providerStatus: t.providerStatus,
        normalizedStatus: t.normalizedStatus,
        eventTime: t.eventTime,
        locationText: t.locationText ?? undefined,
        note: t.note ?? undefined,
        source: t.source,
        createdAt: t.createdAt,
      }),
    ),
  };
}

const shipmentInclude = { items: true, history: true, tracking: true } as const;

export class PrismaShippingRepository implements ShippingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createQuote(input: CreateQuoteInput): Promise<ShippingQuote> {
    const row = await this.prisma.$transaction(async (tx) => {
      const quote = await tx.shippingQuote.create({
        data: {
          id: input.id,
          orderId: input.orderId,
          orderCode: input.orderCode,
          customerId: input.customerId,
          deliveryMethod: input.deliveryMethod,
          totalFee: input.totalFee,
          packageFees: asJson(input.packageFees),
          provider: input.provider,
          expiresAt: input.expiresAt,
          snapshotJson: asJson(input.snapshotJson),
        },
      });
      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: mapOutboxCreateMany(input.outboxEvents),
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'shipping.quote.create',
          actorId: input.actorId,
          details: asJson({ quoteId: quote.id }),
        },
      });
      return quote;
    });
    return mapQuote(row);
  }

  async findQuoteById(id: string): Promise<ShippingQuote | null> {
    const row = await this.prisma.shippingQuote.findUnique({ where: { id } });
    return row ? mapQuote(row) : null;
  }

  async createSlot(input: CreateSlotInput): Promise<DeliverySlot> {
    const row = await this.prisma.deliverySlot.create({
      data: {
        id: input.id,
        deliveryDate: input.deliveryDate,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        deliveryMethod: input.deliveryMethod,
        locationType: input.locationType,
        locationId: input.locationId,
        capacity: input.capacity,
        cutoffAt: input.cutoffAt,
        timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
      },
    });
    return mapSlot(row);
  }

  async findSlotById(id: string): Promise<DeliverySlot | null> {
    const row = await this.prisma.deliverySlot.findUnique({ where: { id } });
    return row ? mapSlot(row) : null;
  }

  async listSlots(filter: ListSlotsFilter): Promise<DeliverySlot[]> {
    const rows = await this.prisma.deliverySlot.findMany({
      where: {
        active: true,
        deliveryMethod: filter.deliveryMethod,
        locationType: filter.locationType,
        locationId: filter.locationId,
        ...(filter.deliveryDate ? { deliveryDate: filter.deliveryDate } : {}),
      },
      orderBy: { deliveryDate: 'asc' },
    });
    let items = rows.map(mapSlot);
    if (filter.onlyAvailable) {
      const now = new Date();
      items = items.filter(
        (s) => s.reservedCount < s.capacity && s.cutoffAt > now,
      );
    }
    return items;
  }

  async reserveSlot(input: ReserveSlotInput): Promise<SlotReservation> {
    const existing = await this.prisma.deliverySlotReservation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return mapReservation(existing);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const slot = await tx.deliverySlot.findUnique({
          where: { id: input.slotId },
        });
        if (!slot || !slot.active) {
          throw new AppError({
            errorCode: ErrorCodes.SHIPPING_SLOT_UNAVAILABLE,
            message: 'Slot không khả dụng',
          });
        }
        if (slot.version !== input.expectedSlotVersion) {
          throw new AppError({
            errorCode: ErrorCodes.SHIPPING_CONFLICT,
            message: 'Slot conflict',
          });
        }
        if (slot.cutoffAt.getTime() <= Date.now()) {
          throw new AppError({
            errorCode: ErrorCodes.SHIPPING_SLOT_EXPIRED,
            message: 'Slot hết hạn',
          });
        }
        if (slot.reservedCount >= slot.capacity) {
          throw new AppError({
            errorCode: ErrorCodes.SHIPPING_SLOT_CAPACITY,
            message: 'Slot hết chỗ',
          });
        }
        await tx.deliverySlot.update({
          where: { id: slot.id, version: input.expectedSlotVersion },
          data: { reservedCount: { increment: 1 }, version: { increment: 1 } },
        });
        const reservation = await tx.deliverySlotReservation.create({
          data: {
            id: input.id,
            slotId: input.slotId,
            orderId: input.orderId,
            customerId: input.customerId,
            expiresAt: input.expiresAt,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (input.outboxEvents.length) {
          await tx.outboxEvent.createMany({
            data: input.outboxEvents.map((e) => ({
              eventType: e.eventType,
              routingKey: e.routingKey,
              payloadJson: asJson(e.payload),
              traceId: e.traceId,
            })),
          });
        }
        return reservation;
      });
      return mapReservation(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const again = await this.prisma.deliverySlotReservation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (again) return mapReservation(again);
      throw error;
    }
  }

  async findReservationById(id: string): Promise<SlotReservation | null> {
    const row = await this.prisma.deliverySlotReservation.findUnique({
      where: { id },
    });
    return row ? mapReservation(row) : null;
  }

  async findReservationByIdempotency(
    key: string,
  ): Promise<SlotReservation | null> {
    const row = await this.prisma.deliverySlotReservation.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? mapReservation(row) : null;
  }

  async releaseReservation(
    id: string,
    actorId: string,
  ): Promise<SlotReservation> {
    const row = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.deliverySlotReservation.findUnique({
        where: { id },
      });
      if (!reservation) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
          message: 'Không tìm thấy đặt chỗ',
        });
      }
      if (reservation.status === 'HELD') {
        await tx.deliverySlotReservation.update({
          where: { id },
          data: { status: 'RELEASED' },
        });
        await tx.deliverySlot.update({
          where: { id: reservation.slotId },
          data: { reservedCount: { decrement: 1 }, version: { increment: 1 } },
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'shipping.slot.release',
          actorId,
          details: asJson({ reservationId: id }),
        },
      });
      return tx.deliverySlotReservation.findUniqueOrThrow({ where: { id } });
    });
    return mapReservation(row);
  }

  async createShipment(input: CreateShipmentInput): Promise<Shipment> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findUnique({
        where: { packageId: input.packageId },
      });
      if (existing) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_ALREADY_EXISTS,
          message: 'Kiện hàng đã có shipment',
        });
      }
      const shipment = await tx.shipment.create({
        data: {
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
          destinationJson: input.destinationJson
            ? asJson(input.destinationJson)
            : undefined,
          shippingFee: input.shippingFee,
          currency: input.currency,
          quoteId: input.quoteId,
          slotReservationId: input.slotReservationId,
          providerShipmentRef: input.providerShipmentRef,
          trackingCode: input.trackingCode,
          estimatedDeliveryAt: input.estimatedDeliveryAt,
          items: {
            create: input.items.map((i) => ({
              skuCode: i.skuCode,
              quantity: i.quantity,
              orderItemId: i.orderItemId,
            })),
          },
          history: {
            create: {
              toStatus: input.status,
              actorId: input.actorId,
              actorType: input.actorType,
            },
          },
        },
        include: shipmentInclude,
      });
      if (input.quoteId) {
        await tx.shippingQuote.update({
          where: { id: input.quoteId },
          data: { status: 'CONSUMED' },
        });
      }
      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((e) => ({
            eventType: e.eventType,
            routingKey: e.routingKey,
            payloadJson: asJson(e.payload),
            traceId: e.traceId,
          })),
        });
      }
      return shipment;
    });
    return mapShipment(row);
  }

  async findShipmentById(id: string): Promise<Shipment | null> {
    const row = await this.prisma.shipment.findUnique({
      where: { id },
      include: shipmentInclude,
    });
    return row ? mapShipment(row) : null;
  }

  async findShipmentByPackageId(packageId: string): Promise<Shipment | null> {
    const row = await this.prisma.shipment.findUnique({
      where: { packageId },
      include: shipmentInclude,
    });
    return row ? mapShipment(row) : null;
  }

  async findShipmentByTrackingCode(
    trackingCode: string,
  ): Promise<Shipment | null> {
    const row = await this.prisma.shipment.findFirst({
      where: { trackingCode },
      include: shipmentInclude,
    });
    return row ? mapShipment(row) : null;
  }

  async findShipmentsByOrderId(orderId: string): Promise<Shipment[]> {
    const rows = await this.prisma.shipment.findMany({
      where: { orderId },
      include: shipmentInclude,
    });
    return rows.map(mapShipment);
  }

  async updateShipmentStatus(
    input: UpdateShipmentStatusInput,
  ): Promise<Shipment> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.shipment.findUnique({
        where: { id: input.shipmentId },
      });
      if (!current) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
          message: 'Không tìm thấy shipment',
        });
      }
      if (current.version !== input.expectedVersion) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_CONFLICT,
          message: 'Shipment conflict',
        });
      }
      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: input.shipmentId,
          fromStatus: current.status,
          toStatus: input.status,
          actorId: input.actorId,
          actorType: input.actorType,
          reason: input.reason,
        },
      });
      if (input.trackingEvent) {
        await tx.trackingEvent.create({
          data: {
            shipmentId: input.shipmentId,
            providerStatus: input.trackingEvent.providerStatus,
            normalizedStatus: input.trackingEvent.normalizedStatus,
            eventTime: input.trackingEvent.eventTime,
            locationText: input.trackingEvent.locationText,
            note: input.trackingEvent.note,
            source: input.trackingEvent.source,
          },
        });
      }
      if (input.consumeSlotReservationId) {
        await tx.deliverySlotReservation.updateMany({
          where: { id: input.consumeSlotReservationId, status: 'HELD' },
          data: { status: 'CONSUMED', shipmentId: input.shipmentId },
        });
      }
      if (input.releaseSlotReservationId) {
        const reservation = await tx.deliverySlotReservation.findUnique({
          where: { id: input.releaseSlotReservationId },
        });
        if (reservation?.status === 'HELD') {
          await tx.deliverySlotReservation.update({
            where: { id: reservation.id },
            data: { status: 'RELEASED' },
          });
          await tx.deliverySlot.update({
            where: { id: reservation.slotId },
            data: {
              reservedCount: { decrement: 1 },
              version: { increment: 1 },
            },
          });
        }
      }
      const updated = await tx.shipment.update({
        where: { id: input.shipmentId, version: input.expectedVersion },
        data: {
          status: input.status,
          version: { increment: 1 },
          providerShipmentRef: input.providerShipmentRef,
          trackingCode: input.trackingCode,
          estimatedDeliveryAt: input.estimatedDeliveryAt,
          pickupCodeHash: input.pickupCodeHash,
          pickupCodeHint: input.pickupCodeHint,
          orderSyncedAt: input.orderSyncedAt,
          stockCommittedAt: input.stockCommittedAt,
          failureAttempts: input.failureAttempts,
        },
        include: shipmentInclude,
      });
      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((e) => ({
            eventType: e.eventType,
            routingKey: e.routingKey,
            payloadJson: asJson(e.payload),
            traceId: e.traceId,
          })),
        });
      }
      return updated;
    });
    return mapShipment(row);
  }

  async markOrderSynced(
    shipmentId: string,
    expectedVersion: number,
    orderSyncedAt: Date,
  ): Promise<Shipment> {
    try {
      const row = await this.prisma.shipment.update({
        where: { id: shipmentId, version: expectedVersion },
        data: { orderSyncedAt, version: { increment: 1 } },
        include: shipmentInclude,
      });
      return mapShipment(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CONFLICT,
        message: 'Shipment conflict',
      });
    }
  }

  async listShipments(
    filter: ListShipmentsFilter,
  ): Promise<ListShipmentsResult> {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.provider) where.provider = filter.provider;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.packageId) where.packageId = filter.packageId;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }
    const orderBy = filter.sort.startsWith('shippingFee')
      ? { shippingFee: filter.sort.endsWith('_asc') ? 'asc' : 'desc' }
      : { createdAt: filter.sort.endsWith('_asc') ? 'asc' : 'desc' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        include: shipmentInclude,
        orderBy: orderBy as any,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return {
      items: rows.map(mapShipment),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async recordCallback(input: CreateCallbackInput): Promise<ProviderCallback> {
    try {
      const row = await this.prisma.providerCallback.create({
        data: {
          provider: input.provider,
          payloadHash: input.payloadHash,
          signatureValid: input.signatureValid,
          rawPayloadJson: asJson(input.rawPayloadJson),
          processed: input.processed,
          resultStatus: input.resultStatus,
          shipmentId: input.shipmentId,
        },
      });
      return {
        id: row.id,
        provider: row.provider,
        payloadHash: row.payloadHash,
        signatureValid: row.signatureValid,
        rawPayloadJson: row.rawPayloadJson as Record<string, unknown>,
        processed: row.processed,
        resultStatus: row.resultStatus,
        shipmentId: row.shipmentId ?? undefined,
        createdAt: row.createdAt,
      };
    } catch {
      const existing = await this.findCallbackByHash(
        input.provider,
        input.payloadHash,
      );
      if (existing) return existing;
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CONFLICT,
        message: 'Callback conflict',
      });
    }
  }

  async findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<ProviderCallback | null> {
    const row = await this.prisma.providerCallback.findUnique({
      where: {
        provider_payloadHash: { provider: provider as any, payloadHash },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      payloadHash: row.payloadHash,
      signatureValid: row.signatureValid,
      rawPayloadJson: row.rawPayloadJson as Record<string, unknown>,
      processed: row.processed,
      resultStatus: row.resultStatus,
      shipmentId: row.shipmentId ?? undefined,
      createdAt: row.createdAt,
    };
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.shipmentIdempotency.findUnique({
      where: { key },
    });
    if (!row) return null;
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
      await this.prisma.shipmentIdempotency.create({
        data: { key, operation, responseJson: asJson(response) },
      });
    } catch {
      // ignore duplicate
    }
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    if (!events.length) return;
    await this.prisma.outboxEvent.createMany({
      data: events.map((e) => ({
        eventType: e.eventType,
        routingKey: e.routingKey,
        payloadJson: asJson(e.payload),
        traceId: e.traceId,
      })),
    });
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      routingKey: r.routingKey,
      payload: r.payloadJson as Record<string, unknown>,
      traceId: r.traceId,
      publishedAt: r.publishedAt ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
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
      data: { action, actorId, details: details ? asJson(details) : undefined },
    });
  }
}
