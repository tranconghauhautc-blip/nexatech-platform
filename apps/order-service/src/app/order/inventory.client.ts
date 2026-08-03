import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { createId } from '@nexatech/shared-platform';
import type {
  LocationType,
  ReservationResult,
  ReserveStockInput,
} from './order.types';

export interface PickupStoreInfo {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  pickupEnabled: boolean;
  isActive: boolean;
}

export interface InventoryClient {
  reserveStock(input: ReserveStockInput): Promise<ReservationResult>;
  releaseReservation(reservationId: string): Promise<void>;
  getReservation(reservationId: string): Promise<ReservationResult | null>;
  getPickupStore(storeId: string): Promise<PickupStoreInfo | null>;
}

interface StoredReservation extends ReservationResult {
  status: 'ACTIVE' | 'RELEASED';
}

export class InMemoryInventoryClient implements InventoryClient {
  private readonly stock = new Map<string, number>();
  private readonly locations = new Map<
    string,
    { locationType: LocationType; locationId: string }
  >();
  private readonly reservations = new Map<string, StoredReservation>();
  private readonly idempotency = new Map<string, ReservationResult>();
  private readonly stores = new Map<string, PickupStoreInfo>();
  failNextReserve = false;

  seed(
    skuCode: string,
    available: number,
    locationType: LocationType = 'warehouse',
    locationId = 'WH-MAIN',
  ): void {
    this.stock.set(skuCode, available);
    this.locations.set(skuCode, { locationType, locationId });
  }

  seedPickupStore(store: PickupStoreInfo): void {
    this.stores.set(store.id, store);
  }

  clear(): void {
    this.stock.clear();
    this.locations.clear();
    this.reservations.clear();
    this.idempotency.clear();
    this.stores.clear();
    this.failNextReserve = false;
  }

  availableFor(skuCode: string): number {
    return this.stock.get(skuCode) ?? 0;
  }

  async reserveStock(input: ReserveStockInput): Promise<ReservationResult> {
    const cached = this.idempotency.get(input.idempotencyKey);
    if (cached) {
      return cached;
    }
    if (this.failNextReserve) {
      this.failNextReserve = false;
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INSUFFICIENT_STOCK,
        message: 'Không đủ tồn kho để giữ hàng',
      });
    }

    for (const line of input.lines) {
      const available = this.stock.get(line.skuCode) ?? 0;
      if (available < line.quantity) {
        throw new AppError({
          errorCode: ErrorCodes.ORDER_INSUFFICIENT_STOCK,
          message: 'Không đủ tồn kho khả dụng cho sản phẩm',
          details: { skuCode: line.skuCode, quantity: line.quantity },
        });
      }
    }

    const lines = input.lines.map((line) => {
      this.stock.set(
        line.skuCode,
        (this.stock.get(line.skuCode) ?? 0) - line.quantity,
      );
      const location = this.locations.get(line.skuCode) ?? {
        locationType: 'warehouse' as LocationType,
        locationId: 'WH-MAIN',
      };
      return {
        skuCode: line.skuCode,
        quantity: line.quantity,
        locationType: location.locationType,
        locationId: location.locationId,
      };
    });

    const reservation: StoredReservation = {
      id: createId(),
      orderId: input.orderId,
      lines,
      status: 'ACTIVE',
    };
    this.reservations.set(reservation.id, reservation);
    const result: ReservationResult = {
      id: reservation.id,
      orderId: reservation.orderId,
      lines: reservation.lines,
    };
    this.idempotency.set(input.idempotencyKey, result);
    return result;
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status === 'RELEASED') {
      return;
    }
    for (const line of reservation.lines) {
      this.stock.set(
        line.skuCode,
        (this.stock.get(line.skuCode) ?? 0) + line.quantity,
      );
    }
    reservation.status = 'RELEASED';
  }

  async getReservation(
    reservationId: string,
  ): Promise<ReservationResult | null> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return null;
    }
    return {
      id: reservation.id,
      orderId: reservation.orderId,
      lines: reservation.lines,
    };
  }

  async getPickupStore(storeId: string): Promise<PickupStoreInfo | null> {
    return this.stores.get(storeId) ?? null;
  }
}

interface ReservationApiShape {
  id: string;
  orderId?: string;
  lines: Array<{
    skuCode: string;
    locationType: LocationType;
    locationId: string;
    quantity: number;
  }>;
}

const ORDER_SERVICE_ACTOR_HEADERS = {
  'x-user-id': 'order-service',
  'x-user-roles': 'Staff',
};

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

  async reserveStock(input: ReserveStockInput): Promise<ReservationResult> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/admin/inventory/stock/reserve`,
      'POST',
      {
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId,
        lines: input.lines.map((line) => ({
          skuCode: line.skuCode,
          quantity: line.quantity,
        })),
      },
    );
    if (response.status === 409) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INSUFFICIENT_STOCK,
        message: 'Không đủ tồn kho khả dụng cho đơn hàng',
      });
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INVENTORY_UNAVAILABLE,
        message: 'Không thể giữ hàng từ inventory-service',
        details: { status: response.status },
      });
    }
    const body = (await response.json()) as ReservationApiShape;
    return this.mapReservation(body);
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/admin/inventory/reservations/${encodeURIComponent(reservationId)}/release`,
      'POST',
    );
    if (!response.ok && response.status !== 409) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INVENTORY_UNAVAILABLE,
        message: 'Không thể huỷ giữ hàng tại inventory-service',
        details: { status: response.status, reservationId },
      });
    }
  }

  async getReservation(
    reservationId: string,
  ): Promise<ReservationResult | null> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/reservations/${encodeURIComponent(reservationId)}`,
      'GET',
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INVENTORY_UNAVAILABLE,
        message: 'Không thể lấy thông tin giữ hàng',
        details: { status: response.status },
      });
    }
    const body = (await response.json()) as ReservationApiShape;
    return this.mapReservation(body);
  }

  async getPickupStore(storeId: string): Promise<PickupStoreInfo | null> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/stores/${encodeURIComponent(storeId)}`,
      'GET',
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_INVENTORY_UNAVAILABLE,
        message: 'Không thể xác minh cửa hàng nhận hàng',
        details: { status: response.status, storeId },
      });
    }
    const body = (await response.json()) as {
      id: string;
      code: string;
      name: string;
      address?: string;
      city?: string;
      phone?: string;
      openingHours?: string;
      pickupEnabled?: boolean;
      isActive?: boolean;
    };
    return {
      id: body.id,
      code: body.code,
      name: body.name,
      address: body.address,
      city: body.city,
      phone: body.phone,
      openingHours: body.openingHours,
      pickupEnabled: body.pickupEnabled === true,
      isActive: body.isActive !== false,
    };
  }

  private mapReservation(body: ReservationApiShape): ReservationResult {
    return {
      id: body.id,
      orderId: body.orderId,
      lines: body.lines.map((line) => ({
        skuCode: line.skuCode,
        quantity: line.quantity,
        locationType: line.locationType,
        locationId: line.locationId,
      })),
    };
  }

  private async fetchWithRetry(
    url: string,
    method: 'GET' | 'POST',
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
            ...ORDER_SERVICE_ACTOR_HEADERS,
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
        HttpInventoryClient.logger.warn(
          `inventory fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.ORDER_INVENTORY_UNAVAILABLE,
      message: 'Không thể kết nối inventory-service',
      details: { cause: String(lastError) },
    });
  }
}
