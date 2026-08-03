import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';

export interface InventoryClient {
  /**
   * Commit reserved stock when a package is picked up (delivery)
   * or store pickup is confirmed. Requires the order reservation id.
   * Idempotent when reservation is already COMMITTED.
   */
  commitOnPickup(input: {
    shipmentId: string;
    orderId: string;
    packageId: string;
    reservationId?: string;
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }>;
}

export class InMemoryInventoryClient implements InventoryClient {
  readonly commits: Array<{
    shipmentId: string;
    orderId: string;
    packageId: string;
    reservationId?: string;
    skuCodes: string[];
    traceId: string;
  }> = [];

  clear(): void {
    this.commits.length = 0;
  }

  async commitOnPickup(input: {
    shipmentId: string;
    orderId: string;
    packageId: string;
    reservationId?: string;
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }> {
    this.commits.push({ ...input });
    return { committed: true, via: 'rest' };
  }
}

const SHIPPING_SERVICE_ACTOR_HEADERS = {
  'x-user-id': 'shipping-service',
  'x-user-roles': 'Staff',
};

/**
 * Calls inventory-service REST commit for the order reservation.
 */
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

  async commitOnPickup(input: {
    shipmentId: string;
    orderId: string;
    packageId: string;
    reservationId?: string;
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }> {
    if (!input.reservationId) {
      HttpInventoryClient.logger.error(
        `Missing reservationId for inventory commit (shipment=${input.shipmentId} order=${input.orderId})`,
      );
      throw createInventoryUnavailableError({
        shipmentId: input.shipmentId,
        orderId: input.orderId,
        reason: 'missing_reservation_id',
      });
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/admin/inventory/reservations/${encodeURIComponent(input.reservationId)}/commit`;
    const response = await this.fetchWithRetry(url, input.traceId);
    if (response.ok || response.status === 409) {
      // 409 = already COMMITTED (idempotent multi-package / retry)
      return { committed: true, via: 'rest' };
    }
    throw createInventoryUnavailableError({
      shipmentId: input.shipmentId,
      orderId: input.orderId,
      reservationId: input.reservationId,
      status: response.status,
    });
  }

  private async fetchWithRetry(
    url: string,
    traceId: string,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            ...SHIPPING_SERVICE_ACTOR_HEADERS,
            'x-trace-id': traceId,
            'content-type': 'application/json',
          },
        });
        clearTimeout(timer);
        if (response.status >= 500 && attempt < this.retries) {
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        HttpInventoryClient.logger.warn(
          `inventory commit attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw createInventoryUnavailableError({
      cause: String(lastError),
    });
  }
}

export function createInventoryUnavailableError(
  details?: Record<string, unknown>,
) {
  return new AppError({
    errorCode: ErrorCodes.SHIPPING_INVENTORY_UNAVAILABLE,
    message: 'Không thể đồng bộ tồn kho khi lấy hàng',
    details,
  });
}
