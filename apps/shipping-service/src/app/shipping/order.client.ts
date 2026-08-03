import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { OrderDto } from '@nexatech/shared-contracts';
import type {
  OrderClientHeaders,
  OrderSnapshot,
  SyncShippingInput,
} from './shipping.types';

export interface OrderClient {
  getOrder(
    orderId: string,
    headers: OrderClientHeaders,
  ): Promise<OrderSnapshot>;
  shippingSync(
    orderId: string,
    input: SyncShippingInput,
    headers: OrderClientHeaders,
  ): Promise<OrderDto>;
}

function mapOrderDto(dto: OrderDto): OrderSnapshot {
  return {
    id: dto.id,
    orderCode: dto.orderCode,
    customerId: dto.customerId,
    status: dto.status,
    deliveryMethod: dto.deliveryMethod,
    pickupStoreId: dto.pickupStoreId,
    reservationId: dto.reservationId,
    shippingAddress: dto.shippingAddress
      ? { ...dto.shippingAddress }
      : undefined,
    packages: dto.packages.map((pkg) => ({
      id: pkg.id,
      packageCode: pkg.packageCode,
      status: pkg.status,
      sourceLocationType: pkg.sourceLocationType,
      sourceLocationId: pkg.sourceLocationId,
      items: pkg.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        skuCode: item.skuCode,
        quantity: item.quantity,
      })),
    })),
    shippingFee: dto.shippingFee,
    currency: dto.currency,
    paymentMethod: dto.paymentMethod,
  };
}

export class InMemoryOrderClient implements OrderClient {
  private orders = new Map<string, OrderSnapshot>();
  readonly syncCalls: Array<{
    orderId: string;
    input: SyncShippingInput;
    headers: OrderClientHeaders;
  }> = [];

  seed(order: OrderSnapshot): void {
    this.orders.set(order.id, {
      ...order,
      packages: order.packages.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i })),
      })),
    });
  }

  clear(): void {
    this.orders.clear();
    this.syncCalls.length = 0;
  }

  async getOrder(
    orderId: string,
    headers: OrderClientHeaders,
  ): Promise<OrderSnapshot> {
    void headers;
    const order = this.orders.get(orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { orderId },
      });
    }
    return {
      ...order,
      packages: order.packages.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i })),
      })),
    };
  }

  async shippingSync(
    orderId: string,
    input: SyncShippingInput,
    headers: OrderClientHeaders,
  ): Promise<OrderDto> {
    this.syncCalls.push({ orderId, input, headers });
    const order = await this.getOrder(orderId, headers);
    const pkg = order.packages.find((p) => p.id === input.packageId);
    if (pkg && input.packageStatus) {
      pkg.status = input.packageStatus;
    }
    if (input.orderStatus) {
      order.status = input.orderStatus;
    }
    this.orders.set(orderId, order);

    return {
      id: order.id,
      orderCode: order.orderCode,
      customerId: order.customerId,
      customerSnapshot: {},
      status: order.status as OrderDto['status'],
      version: 1,
      cartId: 'cart-test',
      deliveryMethod: order.deliveryMethod,
      paymentMethod:
        (order.paymentMethod as OrderDto['paymentMethod']) ?? 'COD',
      paymentStatus: 'UNPAID',
      currency: order.currency,
      merchandiseSubtotal: 0,
      shippingFee: order.shippingFee,
      discountTotal: 0,
      grandTotal: order.shippingFee,
      totalQuantity: 1,
      inventoryReleased: false,
      items: [],
      packages: order.packages.map((p) => ({
        id: p.id,
        packageCode: p.packageCode,
        status: p.status as OrderDto['packages'][0]['status'],
        sourceLocationType: p.sourceLocationType,
        sourceLocationId: p.sourceLocationId,
        shippingProvider: input.shippingProvider,
        trackingCode: input.trackingCode,
        estimatedDeliveryAt: input.estimatedDeliveryAt,
        items: p.items.map((i) => ({
          id: i.id,
          orderItemId: i.orderItemId,
          skuCode: i.skuCode,
          quantity: i.quantity,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class HttpOrderClient implements OrderClient {
  private static readonly logger = new Logger(HttpOrderClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
    private readonly maxRetries = 2,
  ) {}

  private headers(actorHeaders: OrderClientHeaders): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (actorHeaders.userId) {
      headers['x-user-id'] = actorHeaders.userId;
    }
    if (actorHeaders.roles?.length) {
      headers['x-user-roles'] = actorHeaders.roles.join(',');
    }
    if (actorHeaders.traceId) {
      headers['x-trace-id'] = actorHeaders.traceId;
    }
    return headers;
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return response;
      } catch (error) {
        lastError = error;
        HttpOrderClient.logger.warn(
          `Gọi order-service thất bại (lần ${attempt + 1}): ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_ORDER_UNAVAILABLE,
      message: 'Không thể kết nối order-service',
      details: { cause: String(lastError) },
    });
  }

  async getOrder(
    orderId: string,
    actorHeaders: OrderClientHeaders,
  ): Promise<OrderSnapshot> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET', headers: this.headers(actorHeaders) },
    );
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { status: response.status, orderId },
      });
    }
    const dto = (await response.json()) as OrderDto;
    return mapOrderDto(dto);
  }

  async shippingSync(
    orderId: string,
    input: SyncShippingInput,
    actorHeaders: OrderClientHeaders,
  ): Promise<OrderDto> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/orders/${encodeURIComponent(orderId)}/shipping-sync`,
      {
        method: 'POST',
        headers: this.headers(actorHeaders),
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_ORDER_UNAVAILABLE,
        message: 'Không thể đồng bộ trạng thái vận chuyển với đơn hàng',
        details: { status: response.status, orderId },
      });
    }
    return (await response.json()) as OrderDto;
  }
}
