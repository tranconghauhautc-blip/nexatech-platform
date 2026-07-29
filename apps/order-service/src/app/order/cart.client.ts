import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  CartSnapshot,
  CartSnapshotItem,
  CartValidationResult,
  ConvertCartInput,
} from './order.types';

export interface CartClient {
  getCurrentCart(userId: string): Promise<CartSnapshot>;
  refreshCart(userId: string): Promise<CartSnapshot>;
  validateCart(userId: string, city?: string): Promise<CartValidationResult>;
  convertCart(userId: string, input: ConvertCartInput): Promise<void>;
}

export class InMemoryCartClient implements CartClient {
  private readonly carts = new Map<string, CartSnapshot>();
  private readonly invalidReasons = new Map<
    string,
    CartValidationResult['issues']
  >();
  failNextConvert = false;
  readonly convertedOrders: Array<{
    userId: string;
    orderId?: string;
    idempotencyKey?: string;
  }> = [];

  seedCart(userId: string, items: CartSnapshotItem[], version = 0): void {
    this.carts.set(userId, {
      id: `cart-${userId}`,
      version,
      items: items.map((item) => ({
        ...item,
        attributes: { ...item.attributes },
      })),
    });
  }

  seedInvalid(userId: string, issues: CartValidationResult['issues']): void {
    this.invalidReasons.set(userId, issues);
  }

  clear(): void {
    this.carts.clear();
    this.invalidReasons.clear();
    this.failNextConvert = false;
    this.convertedOrders.length = 0;
  }

  async getCurrentCart(userId: string): Promise<CartSnapshot> {
    return (
      this.carts.get(userId) ?? { id: `cart-${userId}`, version: 0, items: [] }
    );
  }

  async refreshCart(userId: string): Promise<CartSnapshot> {
    return this.getCurrentCart(userId);
  }

  async validateCart(userId: string): Promise<CartValidationResult> {
    const forced = this.invalidReasons.get(userId);
    if (forced) {
      return { valid: false, issues: forced };
    }
    const cart = await this.getCurrentCart(userId);
    if (cart.items.length === 0) {
      return {
        valid: false,
        issues: [{ skuCode: '', code: 'EMPTY', message: 'Giỏ hàng trống' }],
      };
    }
    return { valid: true, issues: [] };
  }

  async convertCart(userId: string, input: ConvertCartInput): Promise<void> {
    if (this.failNextConvert) {
      this.failNextConvert = false;
      throw new AppError({
        errorCode: ErrorCodes.ORDER_CART_UNAVAILABLE,
        message: 'Không thể chuyển đổi giỏ hàng sau khi đặt hàng',
      });
    }
    this.convertedOrders.push({ userId, ...input });
    this.carts.delete(userId);
  }
}

interface CartItemDtoShape {
  skuId: string;
  skuCode: string;
  quantity: number;
  unitPriceSnapshot: number;
  currency: string;
  productId: string;
  productName: string;
  skuName: string;
  attributes: Record<string, string>;
}

interface CartDtoShape {
  id: string;
  version: number;
  items: CartItemDtoShape[];
}

interface CartValidateResponseShape {
  valid: boolean;
  issues: Array<{ skuCode: string; code: string; message: string }>;
}

export class HttpCartClient implements CartClient {
  private static readonly logger = new Logger(HttpCartClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(
      process.env['CART_HTTP_TIMEOUT_MS'] ?? 3000,
    ),
    private readonly retries = Number(process.env['CART_HTTP_RETRIES'] ?? 2),
  ) {}

  async getCurrentCart(userId: string): Promise<CartSnapshot> {
    const body = await this.request<CartDtoShape>(
      'GET',
      '/api/v1/carts/current',
      userId,
    );
    return this.mapCart(body);
  }

  async refreshCart(userId: string): Promise<CartSnapshot> {
    const body = await this.request<CartDtoShape>(
      'POST',
      '/api/v1/carts/current/refresh',
      userId,
    );
    return this.mapCart(body);
  }

  async validateCart(
    userId: string,
    city?: string,
  ): Promise<CartValidationResult> {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    const body = await this.request<CartValidateResponseShape>(
      'POST',
      `/api/v1/carts/current/validate${query}`,
      userId,
    );
    return {
      valid: body.valid,
      issues: body.issues.map((issue) => ({
        skuCode: issue.skuCode,
        code: issue.code,
        message: issue.message,
      })),
    };
  }

  async convertCart(userId: string, input: ConvertCartInput): Promise<void> {
    await this.request('POST', '/api/v1/carts/convert', userId, input);
  }

  private mapCart(body: CartDtoShape): CartSnapshot {
    return {
      id: body.id,
      version: body.version,
      items: body.items.map((item) => ({
        skuId: item.skuId,
        skuCode: item.skuCode,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPriceSnapshot,
        currency: item.currency,
        productId: item.productId,
        productName: item.productName,
        skuName: item.skuName,
        attributes: item.attributes ?? {},
      })),
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    userId: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await this.fetchWithRetry(url, method, userId, body);
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_CART_UNAVAILABLE,
        message: 'Không thể giao tiếp với cart-service',
        details: { status: response.status, path },
      });
    }
    return (await response.json()) as T;
  }

  private async fetchWithRetry(
    url: string,
    method: 'GET' | 'POST',
    userId: string,
    body?: unknown,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            'x-user-id': userId,
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        clearTimeout(timer);
        if (response.status >= 500 && attempt < this.retries) {
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        HttpCartClient.logger.warn(
          `cart fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.ORDER_CART_UNAVAILABLE,
      message: 'Không thể kết nối cart-service',
      details: { cause: String(lastError) },
    });
  }
}
