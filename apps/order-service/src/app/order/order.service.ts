import {
  ORDER_SHIPPING_FEE_VND,
  cancelOrderRequestSchema,
  confirmOrderRequestSchema,
  createOrderRequestSchema,
  createPaginatedResponse,
  listOrdersQuerySchema,
  orderStatusTransitionRequestSchema,
  syncOrderPaymentRequestSchema,
  syncOrderReturnRequestSchema,
  syncOrderShippingRequestSchema,
  type CancelOrderRequest,
  type ConfirmOrderRequest,
  type CreateOrderRequest,
  type ListOrdersQuery,
  type OrderAddressDto,
  type OrderAddressInput,
  type OrderDto,
  type OrderItemDto,
  type OrderPackageDto,
  type OrderStatusHistoryDto,
  type OrderStatusTransitionRequest,
  type PaginatedResponse,
  type SyncOrderPaymentRequest,
  type SyncOrderReturnRequest,
  type SyncOrderShippingRequest,
} from '@nexatech/shared-contracts';
import {
  hasMinimumRole,
  isRole,
  isStaff,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  enforceResourceOwnership,
  allowSensitiveBusinessFlow,
} from '@nexatech/shared-security-lab';
import {
  EventTypes,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import { createId, createTraceId } from '@nexatech/shared-platform';
import { ZodError } from 'zod';
import type { CartClient } from './cart.client';
import type { CatalogClient } from './catalog.client';
import type { OrderEventPublisher } from './event-publisher';
import type { InventoryClient } from './inventory.client';
import { generateOrderCode } from './order-code';
import { assertTransition } from './order-state-machine';
import type { OrderRepository } from './order.repository';
import type {
  CreateOrderAddressInput,
  CreateOrderItemInput,
  CreateOrderPackageInput,
  Order,
  OrderPackage,
  OrderStatus,
  OrderStatusHistoryEntry,
  OutboxEventInput,
  ReservationLineResult,
  ReservationResult,
} from './order.types';
import { OutboxDispatcher } from './outbox.dispatcher';

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
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((role) => role.trim())
    .filter(isRole);
}

export interface OrderActor {
  userId?: string;
  customerId?: string;
  roles: Role[];
}

export function parseActor(userId?: string, rolesHeader?: string): OrderActor {
  const trimmedUserId = userId?.trim() || undefined;
  return {
    userId: trimmedUserId,
    customerId: trimmedUserId,
    roles: parseRolesHeader(rolesHeader),
  };
}

function requireCustomerId(actor: OrderActor): string {
  const id = actor.customerId ?? actor.userId;
  if (!id) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Cần đăng nhập',
    });
  }
  return id;
}

function actorIdOf(actor: OrderActor): string {
  return actor.customerId ?? actor.userId ?? 'system';
}

export class OrderService {
  private readonly outbox: OutboxDispatcher;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly recentCreateCounts = new Map<string, number>();

  constructor(
    private readonly repository: OrderRepository,
    private readonly catalog: CatalogClient,
    private readonly cart: CartClient,
    private readonly inventory: InventoryClient,
    publisher: OrderEventPublisher,
  ) {
    this.outbox = new OutboxDispatcher(repository, publisher);
  }

  async createOrder(actor: OrderActor, raw: unknown): Promise<OrderDto> {
    const customerId = requireCustomerId(actor);
    const recentCount = this.recentCreateCounts.get(customerId) ?? 0;
    if (
      !allowSensitiveBusinessFlow({
        recentCount,
        maxPerWindow: 20,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.RATE_LIMITED,
        message: 'Quá nhiều yêu cầu tạo đơn trong cửa sổ thời gian',
      });
    }
    const input = parseOrThrow(() => createOrderRequestSchema.parse(raw));

    const order = await this.withIdempotency(
      input.idempotencyKey,
      'order.create',
      () => this.doCreateOrder(customerId, input),
    );
    this.recentCreateCounts.set(customerId, recentCount + 1);
    return order;
  }

  private async doCreateOrder(
    customerId: string,
    input: CreateOrderRequest,
  ): Promise<OrderDto> {
    await this.cart.refreshCart(customerId);
    const cartSnapshot = await this.cart.getCurrentCart(customerId);
    if (cartSnapshot.items.length === 0) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_EMPTY_CART,
        message: 'Giỏ hàng trống, không thể tạo đơn hàng',
      });
    }

    const validation = await this.cart.validateCart(customerId, input.city);
    if (!validation.valid) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_CART_INVALID,
        message: 'Giỏ hàng không hợp lệ để tạo đơn hàng',
        details: { issues: validation.issues },
      });
    }

    if (input.deliveryMethod === 'STORE_PICKUP') {
      if (!input.pickupStoreId) {
        throw new AppError({
          errorCode: ErrorCodes.VALIDATION_FAILED,
          message: 'Vui lòng chọn cửa hàng nhận hàng',
        });
      }
      const store = await this.inventory.getPickupStore(input.pickupStoreId);
      if (!store || !store.isActive || !store.pickupEnabled) {
        throw new AppError({
          errorCode: ErrorCodes.VALIDATION_FAILED,
          message: 'Cửa hàng nhận hàng không khả dụng',
          details: { pickupStoreId: input.pickupStoreId },
        });
      }
    }

    const repriced: Array<{
      skuId: string;
      skuCode: string;
      quantity: number;
      unitPrice: number;
      currency: string;
      productId: string;
      productName: string;
      skuName: string;
      attributes: Record<string, string>;
    }> = [];
    const priceChangedLines: Array<{
      skuCode: string;
      previousUnitPrice: number;
      currentUnitPrice: number;
    }> = [];

    for (const item of cartSnapshot.items) {
      const sku = await this.catalog.getSkuByCode(item.skuCode);
      if (!sku || !sku.isSellable) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_SKU_UNAVAILABLE,
          message: 'Sản phẩm không còn khả dụng để đặt hàng',
          details: { skuCode: item.skuCode },
        });
      }
      if (sku.unitPrice !== item.unitPriceSnapshot) {
        priceChangedLines.push({
          skuCode: item.skuCode,
          previousUnitPrice: item.unitPriceSnapshot,
          currentUnitPrice: sku.unitPrice,
        });
      }
      repriced.push({
        skuId: sku.skuId,
        skuCode: sku.skuCode,
        quantity: item.quantity,
        unitPrice: sku.unitPrice,
        currency: sku.currency,
        productId: sku.productId,
        productName: sku.productName,
        skuName: sku.skuName,
        attributes: sku.attributes,
      });
    }

    if (priceChangedLines.length > 0) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_PRICE_CHANGED,
        message: 'Giá một số sản phẩm đã thay đổi, vui lòng làm mới giỏ hàng',
        details: { lines: priceChangedLines },
      });
    }

    const orderId = createId();
    const orderCode = generateOrderCode();

    let reservation: ReservationResult;
    try {
      reservation = await this.inventory.reserveStock({
        idempotencyKey: `order-reserve:${input.idempotencyKey}`,
        orderId,
        lines: repriced.map((line) => ({
          skuCode: line.skuCode,
          quantity: line.quantity,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({
        errorCode: ErrorCodes.ORDER_RESERVATION_FAILED,
        message: 'Không thể giữ hàng cho đơn hàng',
      });
    }

    let orderPersisted = false;
    try {
      const items: CreateOrderItemInput[] = repriced.map((line) => ({
        skuId: line.skuId,
        skuCode: line.skuCode,
        skuName: line.skuName,
        productId: line.productId,
        productName: line.productName,
        variantAttributes: line.attributes,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineSubtotal: line.unitPrice * line.quantity,
        currency: line.currency,
      }));

      const merchandiseSubtotal = items.reduce(
        (sum, item) => sum + item.lineSubtotal,
        0,
      );
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const shippingFee =
        input.deliveryMethod === 'STORE_PICKUP'
          ? 0
          : ORDER_SHIPPING_FEE_VND[input.deliveryMethod];
      const discountTotal = 0;
      const grandTotal = merchandiseSubtotal + shippingFee - discountTotal;

      const status: OrderStatus =
        input.paymentMethod === 'COD' ? 'CONFIRMED' : 'AWAITING_PAYMENT';
      const paymentStatus =
        input.paymentMethod === 'COD'
          ? ('UNPAID' as const)
          : ('PENDING' as const);

      const packages = this.buildPackages(orderCode, reservation.lines);

      const traceId = createTraceId();
      const outboxEvents: OutboxEventInput[] = [
        this.buildEvent(EventTypes.ORDER_CREATED, traceId, {
          orderId,
          orderCode,
          customerId,
          grandTotal,
          totalQuantity,
          status,
        }),
      ];
      for (const pkg of packages) {
        outboxEvents.push(
          this.buildEvent(EventTypes.ORDER_PACKAGE_CREATED, traceId, {
            orderId,
            packageCode: pkg.packageCode,
            sourceLocationType: pkg.sourceLocationType,
            sourceLocationId: pkg.sourceLocationId,
          }),
        );
      }
      if (status === 'CONFIRMED') {
        outboxEvents.push(
          this.buildEvent(EventTypes.ORDER_CONFIRMED, traceId, {
            orderId,
            orderCode,
          }),
        );
      }

      const address = input.shippingAddress
        ? this.buildAddress(input.shippingAddress)
        : undefined;

      const order = await this.repository.createOrderWithRelations({
        id: orderId,
        orderCode,
        customerId,
        customerDisplayName: input.customerDisplayName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        status,
        cartId: cartSnapshot.id,
        reservationId: reservation.id,
        deliveryMethod: input.deliveryMethod,
        deliverySlot: input.deliverySlot,
        pickupStoreId: input.pickupStoreId,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        currency: items[0]?.currency ?? 'VND',
        merchandiseSubtotal,
        shippingFee,
        discountTotal,
        grandTotal,
        totalQuantity,
        items,
        address,
        packages,
        actorId: customerId,
        actorType: 'customer',
        outboxEvents,
      });
      orderPersisted = true;

      try {
        await this.cart.convertCart(customerId, {
          orderId: order.id,
          idempotencyKey: `order-convert:${input.idempotencyKey}`,
        });
      } catch (error) {
        await this.inventory
          .releaseReservation(reservation.id)
          .catch(() => undefined);
        assertTransition(order.status, 'FAILED');
        const failedTraceId = createTraceId();
        await this.repository.updateStatus({
          orderId: order.id,
          expectedVersion: order.version,
          toStatus: 'FAILED',
          actorId: 'system',
          actorType: 'system',
          reason: 'Không thể chuyển đổi giỏ hàng sau khi tạo đơn',
          inventoryReleased: true,
          outboxEvents: [
            this.buildEvent(EventTypes.ORDER_FAILED, failedTraceId, {
              orderId: order.id,
              reason: 'cart_convert_failed',
            }),
          ],
        });
        await this.outbox.dispatchPending();
        throw new AppError({
          errorCode: ErrorCodes.ORDER_CART_UNAVAILABLE,
          message: 'Không thể hoàn tất chuyển đổi giỏ hàng, đơn hàng đã bị huỷ',
          details: { orderId: order.id, cause: String(error) },
        });
      }

      await this.repository.writeAudit('order.created', customerId, {
        orderId: order.id,
        orderCode: order.orderCode,
      });
      await this.outbox.dispatchPending();

      return this.toDto(order);
    } catch (error) {
      if (!orderPersisted) {
        await this.inventory
          .releaseReservation(reservation.id)
          .catch(() => undefined);
      }
      throw error;
    }
  }

  async listMyOrders(
    actor: OrderActor,
    query: unknown,
  ): Promise<PaginatedResponse<OrderDto>> {
    const customerId = requireCustomerId(actor);
    const input = parseOrThrow(() => listOrdersQuerySchema.parse(query));
    const result = await this.repository.list({
      ...this.toListFilter(input),
      customerId,
    });
    return createPaginatedResponse(
      result.items.map((order) => this.toDto(order)),
      result.total,
      input,
    );
  }

  async getMyOrder(actor: OrderActor, orderId: string): Promise<OrderDto> {
    const customerId = requireCustomerId(actor);
    const order = await this.requireOrder(orderId);
    if (
      enforceResourceOwnership({
        resourceOwnerId: order.customerId,
        actorId: customerId,
        actorIsStaff: isStaff(actor.roles),
        staffAllowed: true,
      }) === 'deny'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_FORBIDDEN,
        message: 'Không có quyền truy cập đơn hàng này',
      });
    }
    return this.toDto(order);
  }

  async adminListOrders(
    actor: OrderActor,
    query: unknown,
  ): Promise<PaginatedResponse<OrderDto>> {
    this.requireStaff(actor);
    const input = parseOrThrow(() => listOrdersQuerySchema.parse(query));
    const result = await this.repository.list(this.toListFilter(input));
    return createPaginatedResponse(
      result.items.map((order) => this.toDto(order)),
      result.total,
      input,
    );
  }

  async adminGetOrder(actor: OrderActor, orderId: string): Promise<OrderDto> {
    this.requireStaff(actor);
    const order = await this.requireOrder(orderId);
    return this.toDto(order);
  }

  async cancelOrder(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    const input = parseOrThrow(() => cancelOrderRequestSchema.parse(raw));
    return this.maybeIdempotent(input.idempotencyKey, 'order.cancel', () =>
      this.doCancelOrder(actor, orderId, input),
    );
  }

  private async doCancelOrder(
    actor: OrderActor,
    orderId: string,
    input: CancelOrderRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);
    this.assertOwnershipOrStaff(order, actor);

    const staffActor = isStaff(actor.roles);
    const customerCancellable: OrderStatus[] = [
      'PENDING',
      'AWAITING_PAYMENT',
      'CONFIRMED',
    ];
    const staffCancellable: OrderStatus[] = [
      ...customerCancellable,
      'PROCESSING',
      'READY_TO_SHIP',
    ];
    const allowed = staffActor ? staffCancellable : customerCancellable;

    if (order.status === 'CANCELLED') {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_ALREADY_CANCELLED,
        message: 'Đơn hàng đã được huỷ trước đó',
      });
    }
    if (!allowed.includes(order.status)) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_CANCEL_NOT_ALLOWED,
        message: 'Không thể huỷ đơn hàng ở trạng thái hiện tại',
        details: { status: order.status },
      });
    }
    assertTransition(order.status, 'CANCELLED');

    let inventoryReleased = order.inventoryReleased;
    if (!inventoryReleased && order.reservationId) {
      await this.inventory.releaseReservation(order.reservationId);
      inventoryReleased = true;
    }

    const refundContractStatus =
      order.paymentMethod !== 'COD' &&
      (order.paymentStatus === 'PAID' || order.paymentStatus === 'PENDING')
        ? ('PENDING' as const)
        : ('NOT_REQUIRED' as const);

    const traceId = createTraceId();
    const updated = await this.repository.updateStatus({
      orderId: order.id,
      expectedVersion: order.version,
      toStatus: 'CANCELLED',
      actorId: actorIdOf(actor),
      actorType: staffActor ? 'staff' : 'customer',
      reason: input.reason,
      cancelReason: input.reason,
      cancelledAt: new Date(),
      inventoryReleased,
      refundContractStatus,
      outboxEvents: [
        this.buildEvent(EventTypes.ORDER_CANCELLED, traceId, {
          orderId: order.id,
          reason: input.reason,
        }),
        // Audit trail vận hành cho reporting (nhật ký) — bổ sung cùng với
        // writeAudit local, không thay thế các kịch bản logging-gap bảo mật
        // (SC-64 vẫn chặn riêng ở tầng security audit).
        this.buildEvent(EventTypes.AUDIT_RECORDED, traceId, {
          action: 'order.cancelled',
          actorId: actorIdOf(actor),
          actorRoles: actor.roles,
          resourceType: 'order',
          orderId: order.id,
          reason: input.reason,
        }),
      ],
    });
    await this.repository.writeAudit('order.cancelled', actorIdOf(actor), {
      orderId: order.id,
      reason: input.reason,
    });
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  async confirmOrder(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    const input = parseOrThrow(() => confirmOrderRequestSchema.parse(raw));
    return this.maybeIdempotent(input.idempotencyKey, 'order.confirm', () =>
      this.doConfirmOrder(actor, orderId, input),
    );
  }

  private async doConfirmOrder(
    actor: OrderActor,
    orderId: string,
    input: ConfirmOrderRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);
    this.assertOwnershipOrStaff(order, actor);
    assertTransition(order.status, 'CONFIRMED');

    const staffActor = isStaff(actor.roles);
    const traceId = createTraceId();
    const isCod = order.paymentMethod === 'COD';
    const updated = await this.repository.updateStatus({
      orderId: order.id,
      expectedVersion: order.version,
      toStatus: 'CONFIRMED',
      actorId: actorIdOf(actor),
      actorType: staffActor ? 'staff' : 'customer',
      reason: input.reason,
      paymentStatus: isCod ? undefined : 'PAID',
      paidAt: isCod ? undefined : new Date(),
      outboxEvents: [
        this.buildEvent(EventTypes.ORDER_CONFIRMED, traceId, {
          orderId: order.id,
        }),
        this.buildEvent(EventTypes.AUDIT_RECORDED, traceId, {
          action: 'order.confirmed',
          actorId: actorIdOf(actor),
          actorRoles: actor.roles,
          resourceType: 'order',
          orderId: order.id,
        }),
      ],
    });
    await this.repository.writeAudit('order.confirmed', actorIdOf(actor), {
      orderId: order.id,
    });
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  async syncPayment(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    this.requireStaff(actor);
    const input = parseOrThrow(() => syncOrderPaymentRequestSchema.parse(raw));
    return this.maybeIdempotent(
      input.idempotencyKey,
      'order.payment-sync',
      () => this.doSyncPayment(actor, orderId, input),
    );
  }

  private async doSyncPayment(
    actor: OrderActor,
    orderId: string,
    input: SyncOrderPaymentRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);

    const alreadyPaid =
      order.paymentStatus === 'PAID' && input.paymentStatus === 'PAID';
    const alreadySame =
      order.paymentStatus === input.paymentStatus &&
      (!input.paymentReference ||
        order.paymentReference === input.paymentReference);

    if (alreadyPaid && alreadySame && !input.confirmOrder) {
      return this.toDto(order);
    }

    let toStatus: OrderStatus | undefined;
    const outboxEvents: OutboxEventInput[] = [];
    const traceId = createTraceId();

    if (
      input.confirmOrder &&
      input.paymentStatus === 'PAID' &&
      order.status === 'AWAITING_PAYMENT'
    ) {
      assertTransition(order.status, 'CONFIRMED');
      toStatus = 'CONFIRMED';
      outboxEvents.push(
        this.buildEvent(EventTypes.ORDER_CONFIRMED, traceId, {
          orderId: order.id,
        }),
      );
    }

    if (
      input.paymentStatus === 'REFUNDED' ||
      input.paymentStatus === 'REFUND_PENDING'
    ) {
      // payment-service owns refund; order chỉ ghi nhận contract status
    }

    const refundContractStatus =
      input.paymentStatus === 'REFUNDED'
        ? ('COMPLETED' as const)
        : input.paymentStatus === 'REFUND_PENDING'
          ? ('PENDING' as const)
          : undefined;

    const updated = await this.repository.updatePayment({
      orderId: order.id,
      expectedVersion: order.version,
      paymentStatus: input.paymentStatus,
      paymentReference: input.paymentReference,
      paidAt: input.paidAt
        ? new Date(input.paidAt)
        : input.paymentStatus === 'PAID'
          ? new Date()
          : undefined,
      refundContractStatus,
      toStatus,
      actorId: actorIdOf(actor),
      actorType: 'staff',
      reason: 'payment-service sync',
      outboxEvents,
    });

    await this.repository.writeAudit('order.payment.synced', actorIdOf(actor), {
      orderId: order.id,
      paymentStatus: input.paymentStatus,
      paymentReference: input.paymentReference,
    });
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  async syncShipping(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    this.requireStaff(actor);
    const input = parseOrThrow(() => syncOrderShippingRequestSchema.parse(raw));
    return this.maybeIdempotent(
      input.idempotencyKey,
      'order.shipping-sync',
      () => this.doSyncShipping(actor, orderId, input),
    );
  }

  async syncReturn(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    this.requireStaff(actor);
    const input = parseOrThrow(() => syncOrderReturnRequestSchema.parse(raw));
    return this.maybeIdempotent(input.idempotencyKey, 'order.return-sync', () =>
      this.doSyncReturn(actor, orderId, input),
    );
  }

  private async doSyncReturn(
    actor: OrderActor,
    orderId: string,
    input: SyncOrderReturnRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);
    const toStatus = input.toStatus as OrderStatus;

    // Idempotent: đã ở trạng thái đích → không cập nhật lần hai
    if (order.status === toStatus) {
      return this.toDto(order);
    }

    assertTransition(order.status, toStatus);

    const traceId = createTraceId();
    const specificEvent = this.eventForTransition(toStatus);
    const outboxEvents: OutboxEventInput[] = [
      this.buildEvent(specificEvent, traceId, {
        orderId: order.id,
        toStatus,
        returnRequestId: input.returnRequestId,
        orderItemId: input.orderItemId,
      }),
    ];
    if (specificEvent !== EventTypes.ORDER_STATUS_CHANGED) {
      outboxEvents.push(
        this.buildEvent(EventTypes.ORDER_STATUS_CHANGED, traceId, {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          returnRequestId: input.returnRequestId,
        }),
      );
    }

    const updated = await this.repository.updateStatus({
      orderId: order.id,
      expectedVersion: order.version,
      toStatus,
      actorId: actorIdOf(actor),
      actorType: 'staff',
      reason: input.reason ?? 'warranty-service return-sync',
      outboxEvents,
    });
    await this.repository.writeAudit('order.return.synced', actorIdOf(actor), {
      orderId: order.id,
      fromStatus: order.status,
      toStatus,
      returnRequestId: input.returnRequestId,
      orderItemId: input.orderItemId,
    });
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  private async doSyncShipping(
    actor: OrderActor,
    orderId: string,
    input: SyncOrderShippingRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);
    const pkg = order.packages.find((p) => p.id === input.packageId);
    if (!pkg) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
        message: 'Không tìm thấy kiện hàng trong đơn',
        details: { packageId: input.packageId },
      });
    }

    const samePackage =
      pkg.trackingCode === (input.trackingCode ?? pkg.trackingCode) &&
      pkg.shippingProvider ===
        (input.shippingProvider ?? pkg.shippingProvider) &&
      (!input.packageStatus || pkg.status === input.packageStatus);

    if (
      samePackage &&
      (!input.orderStatus || order.status === input.orderStatus)
    ) {
      return this.toDto(order);
    }

    let toStatus = input.orderStatus;
    const outboxEvents: OutboxEventInput[] = [];
    const traceId = createTraceId();

    if (toStatus && toStatus !== order.status) {
      assertTransition(order.status, toStatus);
      outboxEvents.push(
        this.buildEvent(this.eventForTransition(toStatus), traceId, {
          orderId: order.id,
          toStatus,
          packageId: input.packageId,
          shipmentId: input.shipmentId,
        }),
      );
    } else if (!toStatus && input.packageStatus === 'SHIPPED') {
      if (order.status === 'READY_TO_SHIP') {
        toStatus = 'SHIPPED';
        assertTransition(order.status, toStatus);
        outboxEvents.push(
          this.buildEvent(EventTypes.ORDER_SHIPPED, traceId, {
            orderId: order.id,
            packageId: input.packageId,
            shipmentId: input.shipmentId,
          }),
        );
      }
    } else if (!toStatus && input.packageStatus === 'DELIVERED') {
      const otherPackagesDelivered = order.packages
        .filter((p) => p.id !== input.packageId)
        .every((p) => p.status === 'DELIVERED' || p.status === 'CANCELLED');
      if (otherPackagesDelivered && order.status === 'SHIPPED') {
        toStatus = 'DELIVERED';
        assertTransition(order.status, toStatus);
        outboxEvents.push(
          this.buildEvent(EventTypes.ORDER_DELIVERED, traceId, {
            orderId: order.id,
            packageId: input.packageId,
            shipmentId: input.shipmentId,
          }),
        );
      }
    }

    const updated = await this.repository.updateShipping({
      orderId: order.id,
      expectedVersion: order.version,
      packageId: input.packageId,
      shipmentId: input.shipmentId,
      trackingCode: input.trackingCode,
      shippingProvider: input.shippingProvider,
      packageStatus: input.packageStatus,
      estimatedDeliveryAt: input.estimatedDeliveryAt
        ? new Date(input.estimatedDeliveryAt)
        : undefined,
      toStatus,
      actorId: actorIdOf(actor),
      actorType: 'staff',
      reason: 'shipping-service sync',
      outboxEvents,
    });

    await this.repository.writeAudit(
      'order.shipping.synced',
      actorIdOf(actor),
      {
        orderId: order.id,
        packageId: input.packageId,
        shipmentId: input.shipmentId,
        packageStatus: input.packageStatus,
      },
    );
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  async transitionStatus(
    actor: OrderActor,
    orderId: string,
    raw: unknown,
  ): Promise<OrderDto> {
    this.requireStaff(actor);
    const input = parseOrThrow(() =>
      orderStatusTransitionRequestSchema.parse(raw),
    );
    return this.maybeIdempotent(input.idempotencyKey, 'order.transition', () =>
      this.doTransitionStatus(actor, orderId, input),
    );
  }

  private async doTransitionStatus(
    actor: OrderActor,
    orderId: string,
    input: OrderStatusTransitionRequest,
  ): Promise<OrderDto> {
    const order = await this.requireOrder(orderId);
    assertTransition(order.status, input.toStatus);

    let inventoryReleased = order.inventoryReleased;
    if (
      input.toStatus === 'CANCELLED' &&
      !inventoryReleased &&
      order.reservationId
    ) {
      await this.inventory.releaseReservation(order.reservationId);
      inventoryReleased = true;
    }

    const traceId = createTraceId();
    const specificEvent = this.eventForTransition(input.toStatus);
    const outboxEvents: OutboxEventInput[] = [
      this.buildEvent(specificEvent, traceId, {
        orderId: order.id,
        toStatus: input.toStatus,
      }),
    ];
    if (specificEvent !== EventTypes.ORDER_STATUS_CHANGED) {
      outboxEvents.push(
        this.buildEvent(EventTypes.ORDER_STATUS_CHANGED, traceId, {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.toStatus,
        }),
      );
    }

    const updated = await this.repository.updateStatus({
      orderId: order.id,
      expectedVersion: order.version,
      toStatus: input.toStatus,
      actorId: actorIdOf(actor),
      actorType: 'staff',
      reason: input.reason,
      inventoryReleased,
      cancelReason: input.toStatus === 'CANCELLED' ? input.reason : undefined,
      cancelledAt: input.toStatus === 'CANCELLED' ? new Date() : undefined,
      outboxEvents,
    });
    await this.repository.writeAudit('order.status.changed', actorIdOf(actor), {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: input.toStatus,
    });
    await this.outbox.dispatchPending();
    return this.toDto(updated);
  }

  async getStatusHistory(
    actor: OrderActor,
    orderId: string,
  ): Promise<OrderStatusHistoryDto[]> {
    const order = await this.requireOrder(orderId);
    this.assertOwnershipOrStaff(order, actor);
    const history = await this.repository.getStatusHistory(orderId);
    return history.map((entry) => this.toHistoryDto(entry));
  }

  async getPackages(
    actor: OrderActor,
    orderId: string,
  ): Promise<OrderPackageDto[]> {
    const order = await this.requireOrder(orderId);
    this.assertOwnershipOrStaff(order, actor);
    return order.packages.map((pkg) => this.toPackageDto(pkg));
  }

  private buildPackages(
    orderCode: string,
    lines: ReservationLineResult[],
  ): CreateOrderPackageInput[] {
    const groups = new Map<string, ReservationLineResult[]>();
    for (const line of lines) {
      const key = `${line.locationType}:${line.locationId}`;
      const arr = groups.get(key) ?? [];
      arr.push(line);
      groups.set(key, arr);
    }
    let index = 0;
    return [...groups.entries()].map(([key, groupLines]) => {
      index += 1;
      const separator = key.indexOf(':');
      const locationType = key.slice(
        0,
        separator,
      ) as ReservationLineResult['locationType'];
      const locationId = key.slice(separator + 1);
      return {
        packageCode: `${orderCode}-P${String(index).padStart(2, '0')}`,
        status: 'ALLOCATED',
        sourceLocationType: locationType,
        sourceLocationId: locationId,
        items: groupLines.map((line) => ({
          skuCode: line.skuCode,
          quantity: line.quantity,
        })),
      };
    });
  }

  private buildAddress(input: OrderAddressInput): CreateOrderAddressInput {
    const fullText = [
      input.line1,
      input.line2,
      input.ward,
      input.district,
      input.city,
      input.province,
    ]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(', ');
    return { ...input, fullText };
  }

  private eventForTransition(status: OrderStatus): EventType {
    switch (status) {
      case 'READY_TO_SHIP':
        return EventTypes.ORDER_READY_TO_SHIP;
      case 'SHIPPED':
        return EventTypes.ORDER_SHIPPED;
      case 'DELIVERED':
        return EventTypes.ORDER_DELIVERED;
      case 'RETURN_REQUESTED':
        return EventTypes.ORDER_RETURN_REQUESTED;
      case 'RETURNED':
        return EventTypes.ORDER_RETURNED;
      case 'FAILED':
        return EventTypes.ORDER_FAILED;
      case 'CANCELLED':
        return EventTypes.ORDER_CANCELLED;
      case 'CONFIRMED':
        return EventTypes.ORDER_CONFIRMED;
      default:
        return EventTypes.ORDER_STATUS_CHANGED;
    }
  }

  private buildEvent(
    eventType: EventType,
    traceId: string,
    payload: Record<string, unknown>,
  ): OutboxEventInput {
    return {
      eventType,
      routingKey: routingKeyFor(eventType),
      payload,
      traceId,
    };
  }

  private requireStaff(actor: OrderActor): void {
    if (!hasMinimumRole(actor.roles, Roles.Staff)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Yêu cầu quyền nhân viên',
      });
    }
  }

  private async requireOrder(orderId: string): Promise<Order> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
        message: 'Không tìm thấy đơn hàng',
      });
    }
    return order;
  }

  private assertOwnershipOrStaff(order: Order, actor: OrderActor): void {
    if (
      enforceResourceOwnership({
        resourceOwnerId: order.customerId,
        actorId: actor.customerId ?? actor.userId,
        actorIsStaff: isStaff(actor.roles),
        staffAllowed: true,
      }) === 'deny'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_FORBIDDEN,
        message: 'Không có quyền truy cập đơn hàng này',
      });
    }
  }

  private toListFilter(input: ListOrdersQuery) {
    return {
      customerId: input.customerId,
      status: input.status,
      orderCode: input.orderCode,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      page: input.page,
      pageSize: input.pageSize,
      sort: input.sort,
    };
  }

  private async withIdempotency<T>(
    key: string,
    operation: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.repository.getIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
        });
      }
      return existing.responseJson as T;
    }

    const inFlightKey = `${operation}:${key}`;
    const pending = this.inFlight.get(inFlightKey) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const result = await execute();
        await this.repository.saveIdempotency(key, operation, result);
        return result;
      } finally {
        this.inFlight.delete(inFlightKey);
      }
    })();
    this.inFlight.set(inFlightKey, promise);
    return promise;
  }

  private async maybeIdempotent<T>(
    key: string | undefined,
    operation: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return execute();
    }
    return this.withIdempotency(key, operation, execute);
  }

  private toDto(order: Order): OrderDto {
    return {
      id: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      customerSnapshot: {
        displayName: order.customerDisplayName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      status: order.status,
      version: order.version,
      cartId: order.cartId,
      reservationId: order.reservationId,
      deliveryMethod: order.deliveryMethod,
      deliverySlot: order.deliverySlot,
      pickupStoreId: order.pickupStoreId,
      shippingAddress: order.address
        ? this.toAddressDto(order.address)
        : undefined,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference,
      paidAt: order.paidAt?.toISOString(),
      currency: order.currency,
      merchandiseSubtotal: order.merchandiseSubtotal,
      shippingFee: order.shippingFee,
      discountTotal: order.discountTotal,
      grandTotal: order.grandTotal,
      totalQuantity: order.totalQuantity,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt?.toISOString(),
      inventoryReleased: order.inventoryReleased,
      refundContractStatus: order.refundContractStatus,
      items: order.items.map((item) => this.toItemDto(item)),
      packages: order.packages.map((pkg) => this.toPackageDto(pkg)),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private toItemDto(item: Order['items'][number]): OrderItemDto {
    return {
      id: item.id,
      skuId: item.skuId,
      skuCode: item.skuCode,
      skuName: item.skuName,
      productId: item.productId,
      productName: item.productName,
      variantAttributes: item.variantAttributes,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineSubtotal: item.lineSubtotal,
      currency: item.currency,
    };
  }

  private toAddressDto(
    address: NonNullable<Order['address']>,
  ): OrderAddressDto {
    return {
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      line1: address.line1,
      line2: address.line2,
      ward: address.ward,
      district: address.district,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      fullText: address.fullText,
    };
  }

  private toPackageDto(pkg: OrderPackage): OrderPackageDto {
    return {
      id: pkg.id,
      packageCode: pkg.packageCode,
      status: pkg.status,
      sourceLocationType: pkg.sourceLocationType,
      sourceLocationId: pkg.sourceLocationId,
      shippingProvider: pkg.shippingProvider,
      trackingCode: pkg.trackingCode,
      estimatedDeliveryAt: pkg.estimatedDeliveryAt?.toISOString(),
      items: pkg.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        skuCode: item.skuCode,
        quantity: item.quantity,
      })),
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    };
  }

  private toHistoryDto(entry: OrderStatusHistoryEntry): OrderStatusHistoryDto {
    return {
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      actorId: entry.actorId,
      actorType: entry.actorType,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
