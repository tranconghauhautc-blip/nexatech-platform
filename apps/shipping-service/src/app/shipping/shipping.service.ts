import {
  bookShipmentRequestSchema,
  cancelShipmentRequestSchema,
  confirmPickupRequestSchema,
  createPaginatedResponse,
  createShipmentRequestSchema,
  createShippingQuoteRequestSchema,
  listDeliverySlotsQuerySchema,
  listShipmentsQuerySchema,
  ORDER_SHIPPING_FEE_VND,
  readyForPickupRequestSchema,
  reserveDeliverySlotRequestSchema,
  shipmentStatusTransitionRequestSchema,
  type BookShipmentRequest,
  type CancelShipmentRequest,
  type ConfirmPickupRequest,
  type CreateShipmentRequest,
  type CreateShippingQuoteRequest,
  type DeliverySlotDto,
  type ListShipmentsQuery,
  type PaginatedResponse,
  type PublicTrackingDto,
  type ReadyForPickupRequest,
  type ReserveDeliverySlotRequest,
  type ShipmentDto,
  type ShipmentStatus,
  type ShipmentStatusTransitionRequest,
  type ShippingQuoteDto,
  type SlotReservationDto,
} from '@nexatech/shared-contracts';
import { Logger } from '@nestjs/common';
import {
  hasMinimumRole,
  isRole,
  isStaff,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  acceptWebhookSignature,
  enforceResourceOwnership,
  trustUpstreamPayload,
} from '@nexatech/shared-security-lab';
import {
  EventTypes,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import { createId, createTraceId } from '@nexatech/shared-platform';
import { createHash, randomBytes } from 'node:crypto';
import { ZodError } from 'zod';
import type { InventoryClient } from './inventory.client';
import type { OrderClient } from './order.client';
import type { ShippingEventPublisher } from './event-publisher';
import { OutboxDispatcher } from './outbox.dispatcher';
import { assertVndInt, addVnd } from './money';
import { assertShipmentTransition } from './shipping-state-machine';
import {
  hashCallbackPayload,
  type ShippingRepository,
} from './shipping.repository';
import type {
  DeliveryMethod,
  OrderClientHeaders,
  OrderSnapshot,
  OutboxEventInput,
  Shipment,
  ShippingProviderCode,
} from './shipping.types';
import { GhnShippingProvider } from './providers/ghn.provider';
import {
  computeMockPackageFee,
  isMockShippingEnabled,
  MockShippingProvider,
} from './providers/mock.provider';
import type { ShippingProviderAdapter } from './providers/shipping-provider';

const QUOTE_TTL_MS = 30 * 60 * 1000;
const SLOT_HOLD_TTL_MS = 60 * 60 * 1000;
const SHIPPABLE_PACKAGE = new Set(['ALLOCATED', 'READY_TO_SHIP']);

function parseOrThrow<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Dữ liệu không hợp lệ',
        details: { issues: error.issues },
      });
    }
    throw error;
  }
}

export function parseRolesHeader(value?: string): Role[] {
  if (!value) return [];
  return value
    .split(',')
    .map((r) => r.trim())
    .filter(isRole);
}

export interface ShippingActor {
  userId?: string;
  customerId?: string;
  roles: Role[];
}

export function parseActor(
  userId?: string,
  rolesHeader?: string,
): ShippingActor {
  const trimmed = userId?.trim() || undefined;
  return {
    userId: trimmed,
    customerId: trimmed,
    roles: parseRolesHeader(rolesHeader),
  };
}

function requireCustomerId(actor: ShippingActor): string {
  const id = actor.customerId ?? actor.userId;
  if (!id) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Cần đăng nhập',
    });
  }
  return id;
}

function actorIdOf(actor: ShippingActor): string {
  return actor.customerId ?? actor.userId ?? 'system';
}

function requireStaff(actor: ShippingActor): void {
  if (!isStaff(actor.roles) && !hasMinimumRole(actor.roles, Roles.Staff)) {
    throw new AppError({
      errorCode: ErrorCodes.FORBIDDEN,
      message: 'Chỉ nhân viên được phép',
    });
  }
}

function assertOwnership(actor: ShippingActor, customerId: string): void {
  if (
    enforceResourceOwnership({
      resourceOwnerId: customerId,
      actorId: actor.customerId ?? actor.userId,
      actorIsStaff:
        isStaff(actor.roles) || hasMinimumRole(actor.roles, Roles.Staff),
      staffAllowed: true,
    }) === 'deny'
  ) {
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_FORBIDDEN,
      message: 'Không có quyền truy cập vận chuyển này',
    });
  }
}

function validateDeliveryConstraints(
  method: DeliveryMethod,
  order: OrderSnapshot,
): void {
  if (method === 'STORE_PICKUP') {
    if (!order.pickupStoreId) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_STORE_REQUIRED,
        message: 'Nhận tại cửa hàng yêu cầu storeId',
      });
    }
    if (order.shippingAddress) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID,
        message: 'Không thể vừa có địa chỉ giao hàng vừa nhận tại cửa hàng',
      });
    }
  } else {
    if (!order.shippingAddress) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_ADDRESS_REQUIRED,
        message: 'Giao tận nơi yêu cầu địa chỉ',
      });
    }
    if (order.pickupStoreId) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID,
        message: 'Không thể vừa có địa chỉ giao hàng vừa nhận tại cửa hàng',
      });
    }
  }
}

function eventForStatus(status: ShipmentStatus): EventType {
  const map: Partial<Record<ShipmentStatus, EventType>> = {
    CREATED: EventTypes.SHIPMENT_CREATED,
    BOOKED: EventTypes.SHIPMENT_BOOKED,
    READY_FOR_PICKUP: EventTypes.SHIPMENT_READY_FOR_PICKUP,
    PICKED_UP: EventTypes.SHIPMENT_PICKED_UP,
    IN_TRANSIT: EventTypes.SHIPMENT_IN_TRANSIT,
    OUT_FOR_DELIVERY: EventTypes.SHIPMENT_OUT_FOR_DELIVERY,
    DELIVERED: EventTypes.SHIPMENT_DELIVERED,
    DELIVERY_FAILED: EventTypes.SHIPMENT_DELIVERY_FAILED,
    CANCELLED: EventTypes.SHIPMENT_CANCELLED,
    RETURN_TO_SENDER: EventTypes.SHIPMENT_RETURN_TO_SENDER,
    RETURNED: EventTypes.SHIPMENT_RETURNED,
  };
  return map[status] ?? EventTypes.SHIPMENT_TRACKING_UPDATED;
}

function buildOutbox(
  shipment: Shipment,
  status: ShipmentStatus,
  traceId: string,
  extra?: Record<string, unknown>,
): OutboxEventInput {
  const eventType = eventForStatus(status);
  return {
    eventType,
    routingKey: routingKeyFor(eventType),
    traceId,
    payload: {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      orderCode: shipment.orderCode,
      packageId: shipment.packageId,
      customerId: shipment.customerId,
      status,
      trackingCode: shipment.trackingCode,
      provider: shipment.provider,
      deliveryMethod: shipment.deliveryMethod,
      shippingFee: shipment.shippingFee,
      ...extra,
    },
  };
}

function hashPickupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function toQuoteDto(
  q: Awaited<ReturnType<ShippingRepository['findQuoteById']>>,
): ShippingQuoteDto {
  if (!q) throw new Error('quote missing');
  return {
    id: q.id,
    orderId: q.orderId,
    orderCode: q.orderCode,
    customerId: q.customerId,
    deliveryMethod: q.deliveryMethod,
    currency: 'VND',
    totalFee: q.totalFee,
    packageFees: q.packageFees,
    provider: q.provider,
    expiresAt: q.expiresAt.toISOString(),
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  };
}

function toSlotDto(
  s: Awaited<ReturnType<ShippingRepository['findSlotById']>>,
): DeliverySlotDto {
  if (!s) throw new Error('slot missing');
  return {
    id: s.id,
    deliveryDate: s.deliveryDate.toISOString().slice(0, 10),
    windowStart: s.windowStart,
    windowEnd: s.windowEnd,
    deliveryMethod: s.deliveryMethod,
    locationType: s.locationType,
    locationId: s.locationId,
    capacity: s.capacity,
    reservedCount: s.reservedCount,
    available: Math.max(0, s.capacity - s.reservedCount),
    cutoffAt: s.cutoffAt.toISOString(),
    timezone: s.timezone,
    active: s.active,
  };
}

function toReservationDto(
  r: Awaited<ReturnType<ShippingRepository['findReservationById']>>,
): SlotReservationDto {
  if (!r) throw new Error('reservation missing');
  return {
    id: r.id,
    slotId: r.slotId,
    orderId: r.orderId,
    shipmentId: r.shipmentId,
    customerId: r.customerId,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

function toShipmentDto(s: Shipment): ShipmentDto {
  return {
    id: s.id,
    orderId: s.orderId,
    orderCode: s.orderCode,
    packageId: s.packageId,
    customerId: s.customerId,
    deliveryMethod: s.deliveryMethod,
    provider: s.provider,
    status: s.status,
    sourceLocationType: s.sourceLocationType,
    sourceLocationId: s.sourceLocationId,
    destination: s.destinationJson,
    shippingFee: s.shippingFee,
    currency: 'VND',
    quoteId: s.quoteId,
    slotReservationId: s.slotReservationId,
    providerShipmentRef: s.providerShipmentRef,
    trackingCode: s.trackingCode,
    estimatedDeliveryAt: s.estimatedDeliveryAt?.toISOString(),
    pickupCodeHint: s.pickupCodeHint,
    failureAttempts: s.failureAttempts,
    version: s.version,
    items: s.items.map((i) => ({
      id: i.id,
      skuCode: i.skuCode,
      quantity: i.quantity,
      orderItemId: i.orderItemId,
    })),
    trackingEvents: s.tracking.map((t) => ({
      id: t.id,
      shipmentId: t.shipmentId,
      providerStatus: t.providerStatus,
      normalizedStatus: t.normalizedStatus,
      eventTime: t.eventTime.toISOString(),
      locationText: t.locationText,
      note: t.note,
      source: t.source,
    })),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function packageStatusForShipment(status: ShipmentStatus): string | undefined {
  if (status === 'BOOKED' || status === 'READY_FOR_PICKUP')
    return 'READY_TO_SHIP';
  if (
    status === 'PICKED_UP' ||
    status === 'IN_TRANSIT' ||
    status === 'OUT_FOR_DELIVERY'
  )
    return 'SHIPPED';
  if (status === 'DELIVERED') return 'DELIVERED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return undefined;
}

/**
 * Gợi ý trạng thái đơn tương ứng với trạng thái shipment hiện tại.
 *
 * Với STORE_PICKUP, `confirmPickup` có thể chuyển thẳng READY_FOR_PICKUP ->
 * DELIVERED (không đi qua PICKED_UP/IN_TRANSIT/OUT_FOR_DELIVERY), nên đơn ở
 * order-service có thể vẫn đang READY_TO_SHIP khi nhận hint DELIVERED này.
 * Vẫn trả về 'DELIVERED' — order-service (doSyncShipping) chịu trách nhiệm tự
 * thăng cấp nhiều bước (READY_TO_SHIP -> SHIPPED -> DELIVERED) cho trường hợp
 * này, không throw lỗi và không bỏ cập nhật packageStatus.
 */
function orderStatusHint(
  status: ShipmentStatus,
  allDelivered: boolean,
): string | undefined {
  if (status === 'DELIVERED' && allDelivered) return 'DELIVERED';
  if (
    status === 'PICKED_UP' ||
    status === 'IN_TRANSIT' ||
    status === 'OUT_FOR_DELIVERY'
  )
    return 'SHIPPED';
  return undefined;
}

/** Sibling shipments that no longer block order-level DELIVERED. */
function isTerminalOrCancelledShipment(status: ShipmentStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}

/**
 * Service-to-service actor for order shipping-sync.
 * Customer confirm-pickup must not forward Customer roles — order-service
 * requireStaff would FORBIDDEN and leave package/order stuck while shipment
 * is already DELIVERED.
 */
function serviceSyncActor(traceId: string): ShippingActor {
  return {
    userId: `shipping-service:${traceId.slice(0, 8)}`,
    roles: [Roles.Staff],
  };
}

export class ShippingService {
  private static readonly logger = new Logger(ShippingService.name);
  private readonly outbox: OutboxDispatcher;
  private readonly mockProvider: MockShippingProvider;
  private readonly ghnProvider: GhnShippingProvider;

  constructor(
    private readonly repository: ShippingRepository,
    private readonly orderClient: OrderClient,
    private readonly inventoryClient: InventoryClient,
    private readonly publisher: ShippingEventPublisher,
  ) {
    this.outbox = new OutboxDispatcher(repository, publisher);
    this.mockProvider = new MockShippingProvider(
      process.env['SHIPPING_WEBHOOK_SECRET'],
    );
    this.ghnProvider = new GhnShippingProvider();
  }

  private headers(actor: ShippingActor, traceId?: string): OrderClientHeaders {
    return { userId: actor.userId, roles: actor.roles.map(String), traceId };
  }

  private resolveProvider(): ShippingProviderAdapter {
    const configured = (
      process.env['SHIPPING_PROVIDER'] ?? 'MOCK'
    ).toUpperCase();
    if (configured === 'GHN') {
      try {
        return this.ghnProvider;
      } catch {
        return this.mockProvider;
      }
    }
    return this.mockProvider;
  }

  private async maybeIdempotent<T>(
    key: string | undefined,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) return fn();
    const existing = await this.repository.getIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
          details: { key, operation, existing: existing.operation },
        });
      }
      return existing.response as T;
    }
    const result = await fn();
    await this.repository.saveIdempotency(key, operation, result);
    return result;
  }

  async createQuote(
    actor: ShippingActor,
    raw: unknown,
  ): Promise<ShippingQuoteDto> {
    const customerId = requireCustomerId(actor);
    const input = parseOrThrow(() =>
      createShippingQuoteRequestSchema.parse(raw),
    );
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.quote.create',
      () => this.doCreateQuote(actor, customerId, input),
    );
  }

  private async doCreateQuote(
    actor: ShippingActor,
    customerId: string,
    input: CreateShippingQuoteRequest,
  ): Promise<ShippingQuoteDto> {
    const order = await this.orderClient.getOrder(
      input.orderId,
      this.headers(actor),
    );
    assertOwnership(actor, order.customerId);
    if (order.customerId !== customerId && !isStaff(actor.roles)) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_FORBIDDEN,
        message: 'Không có quyền',
      });
    }

    const method = (input.deliveryMethod ??
      order.deliveryMethod) as DeliveryMethod;
    validateDeliveryConstraints(method, order);

    const packages = input.packageIds?.length
      ? order.packages.filter((p) => input.packageIds!.includes(p.id))
      : order.packages;
    if (!packages.length) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PACKAGE_NOT_SHIPPABLE,
        message: 'Không có kiện hàng để báo giá',
      });
    }

    const provider = this.resolveProvider();
    let packageFees: Array<{ packageId: string; fee: number }>;
    let totalFee: number;
    let providerCode: ShippingProviderCode = 'MOCK';

    try {
      if (provider.code === 'MOCK' && !isMockShippingEnabled()) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_MOCK_DISABLED,
          message: 'Mock shipping disabled',
        });
      }
      const quoted = await provider.quote({
        orderId: order.id,
        orderCode: order.orderCode,
        deliveryMethod: method,
        packageIds: packages.map((p) => p.id),
        city:
          typeof order.shippingAddress?.['city'] === 'string'
            ? (order.shippingAddress['city'] as string)
            : undefined,
      });
      packageFees = quoted.packageFees;
      totalFee = quoted.totalFee;
      providerCode = quoted.provider;
    } catch {
      packageFees = packages.map((p) => ({
        packageId: p.id,
        fee: ORDER_SHIPPING_FEE_VND[method],
      }));
      totalFee = packageFees.reduce((sum, p) => addVnd(sum, p.fee), 0);
      providerCode = 'MOCK';
    }

    assertVndInt(totalFee, 'Phí vận chuyển');
    for (const fee of packageFees) assertVndInt(fee.fee, 'Phí kiện');

    const traceId = createTraceId();
    const quote = await this.repository.createQuote({
      id: createId(),
      orderId: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      deliveryMethod: method,
      totalFee,
      packageFees,
      provider: providerCode,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      snapshotJson: {
        packageIds: packages.map((p) => p.id),
        method,
      },
      outboxEvents: [
        {
          eventType: EventTypes.SHIPPING_QUOTE_CREATED,
          routingKey: routingKeyFor(EventTypes.SHIPPING_QUOTE_CREATED),
          traceId,
          payload: { orderId: order.id, totalFee, method },
        },
      ],
      actorId: actorIdOf(actor),
    });
    await this.outbox.dispatchPending();
    return toQuoteDto(quote);
  }

  async listSlots(
    actor: ShippingActor,
    query: Record<string, unknown>,
  ): Promise<DeliverySlotDto[]> {
    void actor;
    const parsed = parseOrThrow(() =>
      listDeliverySlotsQuerySchema.parse(query),
    );
    const slots = await this.repository.listSlots({
      deliveryDate: parsed.deliveryDate
        ? new Date(parsed.deliveryDate)
        : undefined,
      deliveryMethod: parsed.deliveryMethod,
      locationType: parsed.locationType,
      locationId: parsed.locationId,
      onlyAvailable: true,
    });
    return slots.map((s) => toSlotDto(s));
  }

  async seedSlot(input: {
    deliveryDate: Date;
    windowStart: string;
    windowEnd: string;
    deliveryMethod: DeliveryMethod;
    locationType: string;
    locationId: string;
    capacity: number;
    cutoffAt: Date;
  }): Promise<DeliverySlotDto> {
    const slot = await this.repository.createSlot({ id: createId(), ...input });
    return toSlotDto(slot);
  }

  async reserveSlot(
    actor: ShippingActor,
    slotId: string,
    raw: unknown,
  ): Promise<SlotReservationDto> {
    const customerId = requireCustomerId(actor);
    const input = parseOrThrow(() =>
      reserveDeliverySlotRequestSchema.parse(raw),
    );
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.slot.reserve',
      () => this.doReserveSlot(actor, customerId, slotId, input),
    );
  }

  private async doReserveSlot(
    actor: ShippingActor,
    customerId: string,
    slotId: string,
    input: ReserveDeliverySlotRequest,
  ): Promise<SlotReservationDto> {
    const existing = await this.repository.findReservationByIdempotency(
      input.idempotencyKey,
    );
    if (existing) return toReservationDto(existing);

    const slot = await this.repository.findSlotById(slotId);
    if (!slot) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SLOT_UNAVAILABLE,
        message: 'Không tìm thấy slot',
      });
    }

    const traceId = createTraceId();
    const reservation = await this.repository.reserveSlot({
      id: createId(),
      slotId: slot.id,
      orderId: input.orderId,
      customerId,
      expiresAt: new Date(Date.now() + SLOT_HOLD_TTL_MS),
      idempotencyKey: input.idempotencyKey,
      expectedSlotVersion: slot.version,
      outboxEvents: [
        {
          eventType: EventTypes.SHIPPING_SLOT_RESERVED,
          routingKey: routingKeyFor(EventTypes.SHIPPING_SLOT_RESERVED),
          traceId,
          payload: { slotId: slot.id, orderId: input.orderId },
        },
      ],
      actorId: actorIdOf(actor),
    });
    await this.outbox.dispatchPending();
    return toReservationDto(reservation);
  }

  async getQuote(
    actor: ShippingActor,
    quoteId: string,
  ): Promise<ShippingQuoteDto> {
    const quote = await this.repository.findQuoteById(quoteId);
    if (!quote) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_QUOTE_NOT_FOUND,
        message: 'Không tìm thấy báo giá vận chuyển',
      });
    }
    assertOwnership(actor, quote.customerId);
    return toQuoteDto(quote);
  }

  async releaseSlotReservation(
    actor: ShippingActor,
    reservationId: string,
  ): Promise<SlotReservationDto> {
    const reservation =
      await this.repository.findReservationById(reservationId);
    if (!reservation) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SLOT_UNAVAILABLE,
        message: 'Không tìm thấy giữ chỗ slot',
      });
    }
    if (
      !isStaff(actor.roles) &&
      reservation.customerId !== requireCustomerId(actor)
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_FORBIDDEN,
        message: 'Không có quyền giải phóng slot này',
      });
    }
    const released = await this.repository.releaseReservation(
      reservationId,
      actorIdOf(actor),
    );
    await this.outbox.dispatchPending();
    return toReservationDto(released);
  }

  async getShipmentTracking(
    actor: ShippingActor,
    shipmentId: string,
  ): Promise<PublicTrackingDto> {
    const shipment = await this.requireShipment(shipmentId);
    assertOwnership(actor, shipment.customerId);
    return {
      trackingCode: shipment.trackingCode ?? shipment.id,
      status: shipment.status,
      deliveryMethod: shipment.deliveryMethod,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString(),
      events: shipment.tracking.map((e) => ({
        status: e.normalizedStatus,
        eventTime: e.eventTime.toISOString(),
        locationText: e.locationText,
        note: e.note,
      })),
    };
  }

  async createShipment(
    actor: ShippingActor,
    raw: unknown,
  ): Promise<ShipmentDto> {
    requireCustomerId(actor);
    const input = parseOrThrow(() => createShipmentRequestSchema.parse(raw));
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.shipment.create',
      () => this.doCreateShipment(actor, input),
    );
  }

  private async doCreateShipment(
    actor: ShippingActor,
    input: CreateShipmentRequest,
  ): Promise<ShipmentDto> {
    const existing = await this.repository.findShipmentByPackageId(
      input.packageId,
    );
    if (existing) {
      assertOwnership(actor, existing.customerId);
      return toShipmentDto(existing);
    }

    const order = await this.orderClient.getOrder(
      input.orderId,
      this.headers(actor),
    );
    assertOwnership(actor, order.customerId);

    const pkg = order.packages.find((p) => p.id === input.packageId);
    if (!pkg) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PACKAGE_NOT_SHIPPABLE,
        message: 'Không tìm thấy kiện hàng',
        details: { packageId: input.packageId },
      });
    }

    const method = (input.deliveryMethod ??
      order.deliveryMethod) as DeliveryMethod;
    validateDeliveryConstraints(method, order);

    let shippingFee: number = ORDER_SHIPPING_FEE_VND[method];
    let quoteId: string | undefined;
    let providerCode: ShippingProviderCode = 'MOCK';

    if (input.quoteId) {
      const quote = await this.repository.findQuoteById(input.quoteId);
      if (!quote) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_QUOTE_NOT_FOUND,
          message: 'Không tìm thấy báo giá',
        });
      }
      if (
        quote.expiresAt.getTime() < Date.now() ||
        quote.status === 'EXPIRED'
      ) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_QUOTE_EXPIRED,
          message: 'Báo giá đã hết hạn',
        });
      }
      if (quote.orderId !== order.id) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_FEE_MISMATCH,
          message: 'Báo giá không khớp đơn hàng',
        });
      }
      const pkgFee = quote.packageFees.find((p) => p.packageId === pkg.id);
      if (!pkgFee) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_FEE_MISMATCH,
          message: 'Báo giá không có phí cho kiện này',
        });
      }
      shippingFee = pkgFee.fee;
      quoteId = quote.id;
      providerCode = quote.provider;
    } else {
      shippingFee = computeMockPackageFee(method, pkg.id);
    }
    assertVndInt(shippingFee);

    if (input.slotReservationId) {
      const reservation = await this.repository.findReservationById(
        input.slotReservationId,
      );
      if (!reservation || reservation.status !== 'HELD') {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_SLOT_UNAVAILABLE,
          message: 'Đặt chỗ slot không hợp lệ',
        });
      }
      if (reservation.expiresAt.getTime() < Date.now()) {
        throw new AppError({
          errorCode: ErrorCodes.SHIPPING_SLOT_EXPIRED,
          message: 'Đặt chỗ slot đã hết hạn',
        });
      }
    }

    const destination =
      method === 'STORE_PICKUP'
        ? { storeId: order.pickupStoreId }
        : (order.shippingAddress as Record<string, unknown> | undefined);

    const traceId = createTraceId();
    const shipmentId = createId();
    const shipment = await this.repository.createShipment({
      id: shipmentId,
      orderId: order.id,
      orderCode: order.orderCode,
      packageId: pkg.id,
      customerId: order.customerId,
      deliveryMethod: method,
      provider: providerCode,
      status: quoteId ? 'QUOTED' : 'CREATED',
      sourceLocationType: pkg.sourceLocationType,
      sourceLocationId: pkg.sourceLocationId,
      destinationJson: destination,
      shippingFee,
      currency: 'VND',
      quoteId,
      slotReservationId: input.slotReservationId,
      items: pkg.items.map((i) => ({
        skuCode: i.skuCode,
        quantity: i.quantity,
        orderItemId: i.orderItemId,
      })),
      outboxEvents: [
        buildOutbox(
          {
            id: shipmentId,
            orderId: order.id,
            orderCode: order.orderCode,
            packageId: pkg.id,
            customerId: order.customerId,
            deliveryMethod: method,
            provider: providerCode,
            status: quoteId ? 'QUOTED' : 'CREATED',
            sourceLocationType: pkg.sourceLocationType,
            sourceLocationId: pkg.sourceLocationId,
            shippingFee,
            currency: 'VND',
            failureAttempts: 0,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [],
            history: [],
            tracking: [],
          },
          'CREATED',
          traceId,
        ),
      ],
      actorId: actorIdOf(actor),
      actorType: isStaff(actor.roles) ? 'staff' : 'customer',
    });
    await this.outbox.dispatchPending();
    return toShipmentDto(shipment);
  }

  async bookShipment(
    actor: ShippingActor,
    shipmentId: string,
    raw: unknown,
  ): Promise<ShipmentDto> {
    requireStaff(actor);
    const input = parseOrThrow(() =>
      bookShipmentRequestSchema.parse(raw ?? {}),
    );
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.shipment.book',
      () => this.doBookShipment(actor, shipmentId, input),
    );
  }

  private async doBookShipment(
    actor: ShippingActor,
    shipmentId: string,
    input: BookShipmentRequest,
  ): Promise<ShipmentDto> {
    const shipment = await this.requireShipment(shipmentId);
    assertShipmentTransition(shipment.status, 'BOOKED');

    const order = await this.orderClient.getOrder(
      shipment.orderId,
      this.headers(actor),
    );
    const pkg = order.packages.find((p) => p.id === shipment.packageId);
    if (!pkg || !SHIPPABLE_PACKAGE.has(pkg.status)) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PACKAGE_NOT_SHIPPABLE,
        message: 'Kiện hàng chưa ALLOCATED/READY_TO_SHIP',
        details: { packageStatus: pkg?.status },
      });
    }

    const provider = this.resolveProvider();
    let providerResult: {
      providerShipmentRef: string;
      trackingCode: string;
      estimatedDeliveryAt?: Date;
    } = {
      providerShipmentRef: `local-${shipment.id}`,
      trackingCode: `NT-${shipment.orderCode}-${shipment.packageId.slice(0, 6).toUpperCase()}`,
      estimatedDeliveryAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    };
    try {
      providerResult = await provider.createShipment({
        shipmentId: shipment.id,
        orderCode: shipment.orderCode,
        packageId: shipment.packageId,
        deliveryMethod: shipment.deliveryMethod,
        destination: shipment.destinationJson,
        shippingFee: shipment.shippingFee,
      });
    } catch {
      // fallback local booking refs
    }

    const traceId = createTraceId();
    const updated = await this.repository.updateShipmentStatus({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: 'BOOKED',
      reason: input.reason ?? 'booked',
      actorId: actorIdOf(actor),
      actorType: 'staff',
      providerShipmentRef: providerResult.providerShipmentRef,
      trackingCode: providerResult.trackingCode,
      estimatedDeliveryAt: providerResult.estimatedDeliveryAt,
      consumeSlotReservationId: shipment.slotReservationId,
      outboxEvents: [
        buildOutbox(
          { ...shipment, trackingCode: providerResult.trackingCode },
          'BOOKED',
          traceId,
        ),
      ],
    });

    await this.syncOrder(actor, updated, traceId);
    await this.outbox.dispatchPending();
    return toShipmentDto(updated);
  }

  async transitionStatus(
    actor: ShippingActor,
    shipmentId: string,
    raw: unknown,
  ): Promise<ShipmentDto> {
    requireStaff(actor);
    const input = parseOrThrow(() =>
      shipmentStatusTransitionRequestSchema.parse(raw),
    );
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.shipment.transition',
      () => this.doTransition(actor, shipmentId, input),
    );
  }

  private async doTransition(
    actor: ShippingActor,
    shipmentId: string,
    input: ShipmentStatusTransitionRequest,
  ): Promise<ShipmentDto> {
    const shipment = await this.requireShipment(shipmentId);
    if (
      shipment.deliveryMethod === 'STORE_PICKUP' &&
      input.toStatus === 'DELIVERED'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID,
        message: 'STORE_PICKUP phải confirm-pickup trước khi đánh dấu đã giao',
      });
    }

    assertShipmentTransition(shipment.status, input.toStatus);
    const traceId = createTraceId();

    let stockCommittedAt = shipment.stockCommittedAt;
    if (input.toStatus === 'PICKED_UP' && !stockCommittedAt) {
      const order = await this.orderClient.getOrder(
        shipment.orderId,
        this.headers(actor, traceId),
      );
      await this.inventoryClient.commitOnPickup({
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        packageId: shipment.packageId,
        reservationId: order.reservationId,
        skuCodes: shipment.items.map((i) => i.skuCode),
        traceId,
      });
      stockCommittedAt = new Date();
    }

    const failureAttempts =
      input.toStatus === 'DELIVERY_FAILED'
        ? shipment.failureAttempts + 1
        : shipment.failureAttempts;

    const updated = await this.repository.updateShipmentStatus({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: input.toStatus,
      reason: input.reason,
      actorId: actorIdOf(actor),
      actorType: 'staff',
      stockCommittedAt,
      failureAttempts,
      trackingEvent: {
        providerStatus: input.toStatus.toLowerCase(),
        normalizedStatus: input.toStatus,
        eventTime: new Date(),
        locationText: input.locationText,
        note: input.note,
        source: 'staff',
      },
      outboxEvents: [
        buildOutbox(shipment, input.toStatus, traceId),
        {
          eventType: EventTypes.SHIPMENT_TRACKING_UPDATED,
          routingKey: routingKeyFor(EventTypes.SHIPMENT_TRACKING_UPDATED),
          traceId,
          payload: { shipmentId: shipment.id, status: input.toStatus },
        },
      ],
    });

    await this.syncOrder(actor, updated, traceId);
    await this.outbox.dispatchPending();
    return toShipmentDto(updated);
  }

  async readyForPickup(
    actor: ShippingActor,
    shipmentId: string,
    raw: unknown,
  ): Promise<ShipmentDto & { pickupCode?: string }> {
    requireStaff(actor);
    const input = parseOrThrow(() =>
      readyForPickupRequestSchema.parse(raw ?? {}),
    );
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.ready-for-pickup',
      () => this.doReadyForPickup(actor, shipmentId, input),
    );
  }

  private async doReadyForPickup(
    actor: ShippingActor,
    shipmentId: string,
    input: ReadyForPickupRequest,
  ): Promise<ShipmentDto & { pickupCode?: string }> {
    const shipment = await this.requireShipment(shipmentId);
    if (shipment.deliveryMethod !== 'STORE_PICKUP') {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_INVALID_METHOD,
        message: 'Chỉ STORE_PICKUP mới sẵn sàng nhận tại cửa hàng',
      });
    }
    assertShipmentTransition(shipment.status, 'READY_FOR_PICKUP');

    const pickupCode = randomBytes(3).toString('hex').toUpperCase();
    const pickupCodeHash = hashPickupCode(pickupCode);
    const pickupCodeHint = `****${pickupCode.slice(-2)}`;
    const traceId = createTraceId();

    const updated = await this.repository.updateShipmentStatus({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: 'READY_FOR_PICKUP',
      reason: input.reason ?? 'ready-for-pickup',
      actorId: actorIdOf(actor),
      actorType: 'staff',
      pickupCodeHash,
      pickupCodeHint,
      outboxEvents: [buildOutbox(shipment, 'READY_FOR_PICKUP', traceId)],
    });
    await this.syncOrder(actor, updated, traceId);
    await this.outbox.dispatchPending();
    // return raw code once — never stored/logged again
    return { ...toShipmentDto(updated), pickupCode };
  }

  async confirmPickup(
    actor: ShippingActor,
    shipmentId: string,
    raw: unknown,
  ): Promise<ShipmentDto> {
    const input = parseOrThrow(() => confirmPickupRequestSchema.parse(raw));
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.confirm-pickup',
      () => this.doConfirmPickup(actor, shipmentId, input),
    );
  }

  private async doConfirmPickup(
    actor: ShippingActor,
    shipmentId: string,
    input: ConfirmPickupRequest,
  ): Promise<ShipmentDto> {
    const shipment = await this.requireShipment(shipmentId);
    assertOwnership(actor, shipment.customerId);
    if (shipment.deliveryMethod !== 'STORE_PICKUP') {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_INVALID_METHOD,
        message: 'Chỉ STORE_PICKUP mới confirm-pickup',
      });
    }

    const normalizedCode = input.pickupCode.trim().toUpperCase();
    if (
      !shipment.pickupCodeHash ||
      hashPickupCode(normalizedCode) !== shipment.pickupCodeHash
    ) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PICKUP_INVALID,
        message: 'Mã nhận hàng không hợp lệ',
      });
    }

    const traceId = createTraceId();

    // Idempotent retry: shipment already DELIVERED but order sync pending.
    if (shipment.status === 'DELIVERED') {
      if (shipment.orderSyncedAt) {
        return toShipmentDto(shipment);
      }
      await this.syncOrder(actor, shipment, traceId, { rethrow: true });
      await this.outbox.dispatchPending();
      const refreshed = await this.requireShipment(shipmentId);
      return toShipmentDto(refreshed);
    }

    if (shipment.status !== 'READY_FOR_PICKUP') {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_INVALID_TRANSITION,
        message: 'Shipment chưa sẵn sàng nhận',
      });
    }

    let stockCommittedAt = shipment.stockCommittedAt;
    if (!stockCommittedAt) {
      const order = await this.orderClient.getOrder(
        shipment.orderId,
        this.headers(actor, traceId),
      );
      await this.inventoryClient.commitOnPickup({
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        packageId: shipment.packageId,
        reservationId: order.reservationId,
        skuCodes: shipment.items.map((i) => i.skuCode),
        traceId,
      });
      stockCommittedAt = new Date();
    }

    // STORE_PICKUP confirm: READY_FOR_PICKUP → DELIVERED (with code verified)
    assertShipmentTransition('READY_FOR_PICKUP', 'DELIVERED');
    const updated = await this.repository.updateShipmentStatus({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: 'DELIVERED',
      reason: 'store-pickup confirmed',
      actorId: actorIdOf(actor),
      actorType: isStaff(actor.roles) ? 'staff' : 'customer',
      stockCommittedAt,
      trackingEvent: {
        providerStatus: 'delivered',
        normalizedStatus: 'DELIVERED',
        eventTime: new Date(),
        source: 'confirm-pickup',
      },
      outboxEvents: [
        buildOutbox(shipment, 'PICKED_UP', traceId),
        buildOutbox(shipment, 'DELIVERED', traceId),
      ],
    });

    // Fail loudly if order sync fails so client can retry (idempotent path above).
    await this.syncOrder(actor, updated, traceId, { rethrow: true });
    await this.outbox.dispatchPending();
    return toShipmentDto(updated);
  }

  async cancelShipment(
    actor: ShippingActor,
    shipmentId: string,
    raw: unknown,
  ): Promise<ShipmentDto> {
    const input = parseOrThrow(() => cancelShipmentRequestSchema.parse(raw));
    return this.maybeIdempotent(
      input.idempotencyKey,
      'shipping.shipment.cancel',
      () => this.doCancel(actor, shipmentId, input),
    );
  }

  private async doCancel(
    actor: ShippingActor,
    shipmentId: string,
    input: CancelShipmentRequest,
  ): Promise<ShipmentDto> {
    const shipment = await this.requireShipment(shipmentId);
    assertOwnership(actor, shipment.customerId);
    if (isTerminalShipmentOrCancelBlocked(shipment.status)) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CANCEL_NOT_ALLOWED,
        message: `Không thể hủy shipment ở trạng thái ${shipment.status}`,
      });
    }
    if (shipment.status === 'CANCELLED') {
      return toShipmentDto(shipment);
    }
    assertShipmentTransition(shipment.status, 'CANCELLED');
    const traceId = createTraceId();
    const updated = await this.repository.updateShipmentStatus({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      status: 'CANCELLED',
      reason: input.reason,
      actorId: actorIdOf(actor),
      actorType: isStaff(actor.roles) ? 'staff' : 'customer',
      releaseSlotReservationId: shipment.slotReservationId,
      outboxEvents: [
        buildOutbox(shipment, 'CANCELLED', traceId),
        ...(shipment.slotReservationId
          ? [
              {
                eventType: EventTypes.SHIPPING_SLOT_RELEASED,
                routingKey: routingKeyFor(EventTypes.SHIPPING_SLOT_RELEASED),
                traceId,
                payload: { reservationId: shipment.slotReservationId },
              } satisfies OutboxEventInput,
            ]
          : []),
      ],
    });
    await this.syncOrder(actor, updated, traceId);
    await this.outbox.dispatchPending();
    return toShipmentDto(updated);
  }

  async getShipment(
    actor: ShippingActor,
    shipmentId: string,
  ): Promise<ShipmentDto> {
    const shipment = await this.requireShipment(shipmentId);
    assertOwnership(actor, shipment.customerId);
    return toShipmentDto(shipment);
  }

  async getByOrder(
    actor: ShippingActor,
    orderId: string,
  ): Promise<ShipmentDto[]> {
    const shipments = await this.repository.findShipmentsByOrderId(orderId);
    if (!shipments.length) {
      const order = await this.orderClient.getOrder(
        orderId,
        this.headers(actor),
      );
      assertOwnership(actor, order.customerId);
      return [];
    }
    assertOwnership(actor, shipments[0]!.customerId);
    return shipments.map(toShipmentDto);
  }

  async listAdmin(
    actor: ShippingActor,
    query: Record<string, unknown>,
  ): Promise<PaginatedResponse<ShipmentDto>> {
    requireStaff(actor);
    const parsed = parseOrThrow(() =>
      listShipmentsQuerySchema.parse(query),
    ) as ListShipmentsQuery;
    const result = await this.repository.listShipments({
      page: parsed.page,
      pageSize: parsed.pageSize,
      status: parsed.status,
      provider: parsed.provider,
      orderId: parsed.orderId,
      customerId: parsed.customerId,
      packageId: parsed.packageId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      sort: parsed.sort,
    });
    return createPaginatedResponse(
      result.items.map(toShipmentDto),
      result.total,
      { page: result.page, pageSize: result.pageSize },
    );
  }

  async publicTracking(trackingCode: string): Promise<PublicTrackingDto> {
    const shipment =
      await this.repository.findShipmentByTrackingCode(trackingCode);
    if (!shipment) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
        message: 'Không tìm thấy mã vận đơn',
      });
    }
    return {
      trackingCode,
      status: shipment.status,
      deliveryMethod: shipment.deliveryMethod,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString(),
      events: shipment.tracking.map((t) => ({
        status: t.normalizedStatus,
        eventTime: t.eventTime.toISOString(),
        locationText: t.locationText,
        note: t.note,
      })),
    };
  }

  async handleWebhook(
    provider: string,
    payload: Record<string, unknown>,
    signature?: string,
  ): Promise<{ ok: boolean; replayed?: boolean }> {
    const code = provider.toUpperCase() === 'GHN' ? 'GHN' : 'MOCK';
    const adapter = code === 'GHN' ? this.ghnProvider : this.mockProvider;
    const signatureValid = adapter.verifyWebhookSignature(payload, signature);
    if (!acceptWebhookSignature({ signatureValid })) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_SIGNATURE_INVALID,
        message: 'Chữ ký webhook không hợp lệ',
      });
    }

    const payloadHash = hashCallbackPayload(payload);
    const existing = await this.repository.findCallbackByHash(
      code,
      payloadHash,
    );
    if (existing?.processed) {
      return { ok: true, replayed: true };
    }

    let parsed;
    try {
      parsed = adapter.handleWebhook(payload);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CALLBACK_INVALID,
        message: 'Payload webhook không hợp lệ',
      });
    }

    const schemaValid = Boolean(parsed?.shipmentId || parsed?.trackingCode);
    const trusted = trustUpstreamPayload({
      payload: parsed,
      schemaValid,
    });
    if (!trusted.accepted) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_CALLBACK_INVALID,
        message: 'Payload webhook không hợp lệ',
      });
    }
    parsed = trusted.payload;

    let shipment: Shipment | null = null;
    if (parsed.shipmentId) {
      shipment = await this.repository.findShipmentById(parsed.shipmentId);
    } else if (parsed.trackingCode) {
      shipment = await this.repository.findShipmentByTrackingCode(
        parsed.trackingCode,
      );
    }
    if (!shipment) {
      await this.repository.recordCallback({
        provider: code,
        payloadHash,
        signatureValid,
        rawPayloadJson: sanitizePayload(payload),
        processed: true,
        resultStatus: 'IGNORED',
      });
      return { ok: true };
    }

    const toStatus = parsed.normalizedStatus;
    if (
      shipment.status !== toStatus &&
      canAttemptTransition(shipment.status, toStatus)
    ) {
      assertShipmentTransition(shipment.status, toStatus);
      const traceId = createTraceId();
      const staffActor: ShippingActor = {
        userId: 'webhook',
        roles: [Roles.Staff],
      };
      const updated = await this.repository.updateShipmentStatus({
        shipmentId: shipment.id,
        expectedVersion: shipment.version,
        status: toStatus,
        reason: 'provider-webhook',
        actorId: 'webhook',
        actorType: 'system',
        trackingEvent: {
          providerStatus: parsed.providerStatus,
          normalizedStatus: toStatus,
          eventTime: new Date(),
          source: 'webhook',
        },
        outboxEvents: [buildOutbox(shipment, toStatus, traceId)],
      });
      await this.syncOrder(staffActor, updated, traceId);
      await this.outbox.dispatchPending();
    }

    await this.repository.recordCallback({
      provider: code,
      payloadHash,
      signatureValid,
      rawPayloadJson: sanitizePayload(payload),
      processed: true,
      resultStatus: 'PROCESSED',
      shipmentId: shipment.id,
    });
    return { ok: true };
  }

  private async requireShipment(id: string): Promise<Shipment> {
    const shipment = await this.repository.findShipmentById(id);
    if (!shipment) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_NOT_FOUND,
        message: 'Không tìm thấy shipment',
      });
    }
    return shipment;
  }

  private async syncOrder(
    _actor: ShippingActor,
    shipment: Shipment,
    traceId: string,
    options: { rethrow?: boolean } = {},
  ): Promise<void> {
    const packageStatus = packageStatusForShipment(shipment.status);
    if (!packageStatus) return;

    // Skip if already synced for delivered terminal and orderSyncedAt set
    if (shipment.orderSyncedAt && shipment.status === 'DELIVERED') {
      return;
    }

    const siblings = await this.repository.findShipmentsByOrderId(
      shipment.orderId,
    );
    const allDelivered = siblings.every((s) =>
      s.id === shipment.id
        ? isTerminalOrCancelledShipment(shipment.status)
        : isTerminalOrCancelledShipment(s.status),
    );

    // Always use Staff service identity — never forward Customer roles.
    // order-service.shipping-sync requires Staff+; customer confirm-pickup
    // previously left package/order at READY_TO_SHIP while shipment=DELIVERED.
    const syncHeaders = this.headers(serviceSyncActor(traceId), traceId);
    const idempotencyKey = `ship-sync-${shipment.id}-${shipment.status}-${shipment.version}`;
    const orderStatus = orderStatusHint(shipment.status, allDelivered);

    try {
      await this.orderClient.shippingSync(
        shipment.orderId,
        {
          packageId: shipment.packageId,
          shipmentId: shipment.id,
          trackingCode: shipment.trackingCode,
          shippingProvider: shipment.provider,
          packageStatus,
          estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString(),
          orderStatus,
          idempotencyKey,
        },
        syncHeaders,
      );
      await this.repository.markOrderSynced(
        shipment.id,
        shipment.version,
        new Date(),
      );
    } catch (error) {
      const errorCode =
        error instanceof AppError
          ? error.errorCode
          : 'SHIPPING_ORDER_SYNC_FAILED';
      ShippingService.logger.error(
        JSON.stringify({
          message: 'order shipping-sync failed',
          eventId: idempotencyKey,
          eventType: 'order.shipping-sync',
          routingKey: 'shipping.order-sync',
          orderId: shipment.orderId,
          shipmentId: shipment.id,
          packageId: shipment.packageId,
          correlationId: traceId,
          attempt: 1,
          errorCode,
          shipmentStatus: shipment.status,
          packageStatus,
          orderStatus,
          error: String(error),
        }),
      );
      if (options.rethrow) {
        throw error instanceof AppError
          ? error
          : new AppError({
              errorCode: ErrorCodes.SHIPPING_ORDER_UNAVAILABLE,
              message:
                'Đã xác nhận nhận hàng nhưng chưa đồng bộ được đơn hàng. Vui lòng thử lại.',
              details: {
                orderId: shipment.orderId,
                shipmentId: shipment.id,
                packageId: shipment.packageId,
                correlationId: traceId,
                cause: String(error),
              },
            });
      }
    }
  }

  /** Expose publisher for tests */
  get eventPublisher(): ShippingEventPublisher {
    return this.publisher;
  }

  get repo(): ShippingRepository {
    return this.repository;
  }
}

function isTerminalShipmentOrCancelBlocked(status: ShipmentStatus): boolean {
  return (
    status === 'DELIVERED' ||
    status === 'RETURNED' ||
    status === 'PICKED_UP' ||
    status === 'IN_TRANSIT' ||
    status === 'OUT_FOR_DELIVERY'
  );
}

function canAttemptTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  try {
    assertShipmentTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

function sanitizePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...payload };
  delete clone['signature'];
  delete clone['token'];
  delete clone['secret'];
  return clone;
}
