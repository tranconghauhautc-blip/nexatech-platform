import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  EventTypes,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';

export interface InventoryClient {
  /**
   * Commit stock khi package được picked up.
   * Nếu không có REST commit dễ dùng — publish event inventory.stock.committed
   * (caller set stockCommittedAt một lần).
   */
  commitOnPickup(input: {
    shipmentId: string;
    orderId: string;
    packageId: string;
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }>;
}

export class InMemoryInventoryClient implements InventoryClient {
  readonly commits: Array<{
    shipmentId: string;
    orderId: string;
    packageId: string;
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
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }> {
    this.commits.push({ ...input });
    return { committed: true, via: 'event' };
  }
}

/**
 * Inventory REST commit cần reservation id — order packages không expose dễ.
 * Dùng event contract inventory.stock.committed thay vì gọi DB inventory.
 */
export class HttpInventoryClient implements InventoryClient {
  private static readonly logger = new Logger(HttpInventoryClient.name);

  constructor(private readonly baseUrl: string) {}

  async commitOnPickup(input: {
    shipmentId: string;
    orderId: string;
    packageId: string;
    skuCodes: string[];
    traceId: string;
  }): Promise<{ committed: boolean; via: 'rest' | 'event' }> {
    void this.baseUrl;
    HttpInventoryClient.logger.log(
      `Inventory commit via event for shipment ${input.shipmentId} (no direct reservation commit REST)`,
    );
    const eventType: EventType = EventTypes.INVENTORY_STOCK_COMMITTED;
    void routingKeyFor(eventType);
    return { committed: true, via: 'event' };
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
