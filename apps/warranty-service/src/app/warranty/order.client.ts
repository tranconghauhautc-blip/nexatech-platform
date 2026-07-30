import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { OrderDto } from '@nexatech/shared-contracts';
import type {
  OrderClientHeaders,
  OrderSnapshot,
  SyncReturnInput,
} from './warranty.types';

export interface OrderClient {
  getOrder(
    orderId: string,
    headers: OrderClientHeaders,
  ): Promise<OrderSnapshot>;
  syncReturn(
    orderId: string,
    input: SyncReturnInput,
    headers: OrderClientHeaders,
  ): Promise<void>;
}

function mapOrderDto(dto: OrderDto): OrderSnapshot {
  return {
    id: dto.id,
    orderCode: dto.orderCode,
    customerId: dto.customerId,
    status: dto.status,
    items: dto.items.map((item) => ({
      id: item.id,
      skuId: item.skuId,
      skuCode: item.skuCode,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
    })),
    packages: dto.packages.map((pkg) => ({
      id: pkg.id,
      status: pkg.status,
      items: pkg.items.map((i) => ({ orderItemId: i.orderItemId })),
    })),
  };
}

export class InMemoryOrderClient implements OrderClient {
  private orders = new Map<string, OrderSnapshot>();
  readonly syncCalls: Array<{ orderId: string; input: SyncReturnInput }> = [];
  failSyncOnce = false;

  seed(order: OrderSnapshot): void {
    this.orders.set(order.id, {
      ...order,
      items: order.items.map((i) => ({ ...i })),
      packages: order.packages.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i })),
      })),
    });
  }

  clear(): void {
    this.orders.clear();
    this.syncCalls.length = 0;
    this.failSyncOnce = false;
  }

  async getOrder(
    orderId: string,
    headers: OrderClientHeaders,
  ): Promise<OrderSnapshot> {
    void headers;
    const order = this.orders.get(orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { orderId },
      });
    }
    return {
      ...order,
      items: order.items.map((i) => ({ ...i })),
      packages: order.packages.map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i })),
      })),
    };
  }

  async syncReturn(
    orderId: string,
    input: SyncReturnInput,
    headers: OrderClientHeaders,
  ): Promise<void> {
    void headers;
    if (this.failSyncOnce) {
      this.failSyncOnce = false;
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_SYNC_FAILED,
        message: 'Không thể đồng bộ trạng thái đơn hàng',
        details: { orderId },
      });
    }
    const order = this.orders.get(orderId);
    if (!order) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_SYNC_FAILED,
        message: 'Không thể đồng bộ trạng thái đơn hàng',
        details: { orderId },
      });
    }
    order.status = input.toStatus;
    this.syncCalls.push({ orderId, input });
  }
}

export class HttpOrderClient implements OrderClient {
  private static readonly logger = new Logger(HttpOrderClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(
      process.env['ORDER_HTTP_TIMEOUT_MS'] ?? 5000,
    ),
    private readonly maxRetries = Number(
      process.env['ORDER_HTTP_RETRIES'] ?? 2,
    ),
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
      errorCode: ErrorCodes.WARRANTY_ORDER_UNAVAILABLE,
      message: 'Không thể kết nối order-service',
      details: { cause: String(lastError) },
    });
  }

  async getOrder(
    orderId: string,
    actorHeaders: OrderClientHeaders,
  ): Promise<OrderSnapshot> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET', headers: this.headers(actorHeaders) },
    );
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_UNAVAILABLE,
        message: 'Không thể lấy thông tin đơn hàng',
        details: { status: response.status, orderId },
      });
    }
    const dto = (await response.json()) as OrderDto;
    return mapOrderDto(dto);
  }

  async syncReturn(
    orderId: string,
    input: SyncReturnInput,
    actorHeaders: OrderClientHeaders,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchWithRetry(
        `${this.baseUrl.replace(/\/$/, '')}/api/v1/orders/${encodeURIComponent(orderId)}/return-sync`,
        {
          method: 'POST',
          headers: this.headers(actorHeaders),
          body: JSON.stringify(input),
        },
      );
    } catch (error) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_SYNC_FAILED,
        message: 'Không thể đồng bộ trạng thái đơn hàng',
        details: { cause: String(error), orderId },
      });
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_ORDER_SYNC_FAILED,
        message: 'Không thể đồng bộ trạng thái đơn hàng',
        details: { status: response.status, orderId },
      });
    }
  }
}
