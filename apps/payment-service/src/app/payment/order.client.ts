import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { OrderDto } from '@nexatech/shared-contracts';
import type {
  OrderClientHeaders,
  OrderSnapshot,
  SyncPaymentInput,
} from './payment.types';

export interface OrderClient {
  getOrder(
    orderId: string,
    headers: OrderClientHeaders,
  ): Promise<OrderSnapshot>;
  syncPayment(
    orderId: string,
    input: SyncPaymentInput,
    headers: OrderClientHeaders,
  ): Promise<OrderDto>;
}

function mapOrderDto(dto: OrderDto): OrderSnapshot {
  return {
    id: dto.id,
    orderCode: dto.orderCode,
    customerId: dto.customerId,
    status: dto.status,
    paymentMethod: dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    grandTotal: dto.grandTotal,
    currency: dto.currency,
  };
}

export class InMemoryOrderClient implements OrderClient {
  private orders = new Map<string, OrderSnapshot>();
  readonly syncCalls: Array<{
    orderId: string;
    input: SyncPaymentInput;
    headers: OrderClientHeaders;
  }> = [];

  seed(order: OrderSnapshot): void {
    this.orders.set(order.id, { ...order });
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
        errorCode: ErrorCodes.PAYMENT_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { orderId },
      });
    }
    return { ...order };
  }

  async syncPayment(
    orderId: string,
    input: SyncPaymentInput,
    headers: OrderClientHeaders,
  ): Promise<OrderDto> {
    this.syncCalls.push({ orderId, input, headers });
    const order = await this.getOrder(orderId, headers);
    if (input.paymentStatus) {
      order.paymentStatus = input.paymentStatus;
    }
    if (input.paymentReference) {
      (
        order as OrderSnapshot & { paymentReference?: string }
      ).paymentReference = input.paymentReference;
    }
    if (input.confirmOrder && order.status === 'AWAITING_PAYMENT') {
      order.status = 'CONFIRMED';
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
      deliveryMethod: 'STANDARD',
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus as OrderDto['paymentStatus'],
      paymentReference: input.paymentReference,
      paidAt: input.paidAt,
      currency: order.currency,
      merchandiseSubtotal: order.grandTotal,
      shippingFee: 0,
      discountTotal: 0,
      grandTotal: order.grandTotal,
      totalQuantity: 1,
      inventoryReleased: false,
      items: [],
      packages: [],
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
      errorCode: ErrorCodes.PAYMENT_ORDER_UNAVAILABLE,
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
        errorCode: ErrorCodes.PAYMENT_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { status: response.status, orderId },
      });
    }
    const dto = (await response.json()) as OrderDto;
    return mapOrderDto(dto);
  }

  async syncPayment(
    orderId: string,
    input: SyncPaymentInput,
    actorHeaders: OrderClientHeaders,
  ): Promise<OrderDto> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/orders/${encodeURIComponent(orderId)}/payment-sync`,
      {
        method: 'POST',
        headers: this.headers(actorHeaders),
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_ORDER_UNAVAILABLE,
        message: 'Không thể đồng bộ trạng thái thanh toán với đơn hàng',
        details: { status: response.status, orderId },
      });
    }
    return (await response.json()) as OrderDto;
  }
}
