import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { InventoryAvailability } from './cart.types';

export interface InventoryClient {
  checkAvailability(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<InventoryAvailability>;
}

export class InMemoryInventoryClient implements InventoryClient {
  private readonly stock = new Map<string, number>();
  failNext = false;

  seed(skuCode: string, available: number): void {
    this.stock.set(skuCode, available);
  }

  clear(): void {
    this.stock.clear();
    this.failNext = false;
  }

  async checkAvailability(
    skuCode: string,
    quantity: number,
  ): Promise<InventoryAvailability> {
    if (this.failNext) {
      this.failNext = false;
      throw new AppError({
        errorCode: ErrorCodes.CART_INVENTORY_UNAVAILABLE,
        message: 'Không thể kiểm tra tồn kho',
      });
    }
    const totalAvailable = this.stock.get(skuCode) ?? 0;
    return {
      skuCode,
      quantityRequested: quantity,
      available: totalAvailable >= quantity,
      totalAvailable,
    };
  }
}

export class HttpInventoryClient implements InventoryClient {
  private static readonly logger = new Logger(HttpInventoryClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(
      process.env['INVENTORY_HTTP_TIMEOUT_MS'] ?? 3000,
    ),
    private readonly retries = Number(
      process.env['INVENTORY_HTTP_RETRIES'] ?? 2,
    ),
  ) {}

  async checkAvailability(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<InventoryAvailability> {
    const params = new URLSearchParams({
      skuCode,
      quantity: String(quantity),
    });
    if (city) {
      params.set('city', city);
    }
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/stock/availability?${params.toString()}`;
    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.CART_INVENTORY_UNAVAILABLE,
        message: 'Không thể kiểm tra tồn kho từ inventory-service',
        details: { status: response.status, skuCode },
      });
    }
    const body = (await response.json()) as
      | Array<{ available?: number }>
      | {
          available?: boolean;
          totalAvailable?: number;
          items?: Array<{ available: number }>;
        };

    let totalAvailable = 0;
    if (Array.isArray(body)) {
      totalAvailable = body.reduce(
        (sum, row) => sum + (Number(row.available) || 0),
        0,
      );
    } else if (Array.isArray(body.items)) {
      totalAvailable = body.items.reduce(
        (sum, row) => sum + (Number(row.available) || 0),
        0,
      );
    } else if (typeof body.totalAvailable === 'number') {
      totalAvailable = body.totalAvailable;
    }

    return {
      skuCode,
      quantityRequested: quantity,
      available: totalAvailable >= quantity,
      totalAvailable,
    };
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (response.status >= 500 && attempt < this.retries) {
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        HttpInventoryClient.logger.warn(
          `inventory fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.CART_INVENTORY_UNAVAILABLE,
      message: 'Không thể kết nối inventory-service',
      details: { cause: String(lastError) },
    });
  }
}
