import { Injectable } from '@nestjs/common';
import {
  hasMinimumRole,
  isRole,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import {
  adjustStockRequestSchema,
  availabilityQuerySchema,
  createStoreRequestSchema,
  createWarehouseRequestSchema,
  issueStockRequestSchema,
  receiveStockRequestSchema,
  reserveStockRequestSchema,
  transferStockRequestSchema,
  updateStoreRequestSchema,
  updateWarehouseRequestSchema,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  createEventEnvelope,
  EventTypes,
  type EventEnvelope,
} from '@nexatech/shared-events';
import {
  createTraceId,
  normalizePage,
  normalizePageSize,
} from '@nexatech/shared-platform';
import type { InventoryEventPublisher } from './event-publisher';
import type { InventoryRepository } from './inventory.repository';
import type {
  LocationType,
  Reservation,
  ReservationLine,
  ReturnStockLineInput,
  ReturnStockRequestInput,
  Store,
  StockItem,
  StockMovement,
  StockSource,
  Transfer,
  Warehouse,
} from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly publisher: InventoryEventPublisher,
  ) {}

  private requireStaff(roles: Role[]): void {
    if (!hasMinimumRole(roles, Roles.Staff)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }
  }

  private requireManager(roles: Role[]): void {
    if (!hasMinimumRole(roles, Roles.Manager)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }
  }

  private async withIdempotency<T>(
    key: string,
    operation: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.repository.findIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.INVENTORY_IDEMPOTENCY_CONFLICT,
          message: 'Khóa idempotency đã được sử dụng cho một thao tác khác',
          details: { key, operation, existingOperation: existing.operation },
        });
      }
      return existing.responseJson as T;
    }
    const result = await execute();
    await this.repository.saveIdempotency(key, operation, result);
    return result;
  }

  private async publish(event: EventEnvelope): Promise<void> {
    await this.publisher.publish(event);
  }

  private async checkLowStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<void> {
    const stock = await this.repository.getStock(
      skuCode,
      locationType,
      locationId,
    );
    if (stock && stock.available <= stock.lowStockThreshold) {
      await this.publish(
        createEventEnvelope({
          eventType: EventTypes.INVENTORY_LOW_STOCK_DETECTED,
          producer: 'inventory-service',
          traceId: createTraceId(),
          payload: {
            skuCode,
            locationType,
            locationId,
            available: stock.available,
            threshold: stock.lowStockThreshold,
          },
        }),
      );
    }
  }

  async createWarehouse(
    rawInput: unknown,
    roles: Role[],
    actorId = 'system',
  ): Promise<Warehouse> {
    this.requireManager(roles);
    const input = createWarehouseRequestSchema.parse(rawInput);
    const warehouse = await this.repository.createWarehouse(input);
    await this.repository.writeAudit('inventory.warehouse.created', actorId, {
      warehouseId: warehouse.id,
      code: warehouse.code,
    });
    return warehouse;
  }

  listWarehouses(): Promise<Warehouse[]> {
    return this.repository.listWarehouses();
  }

  async updateWarehouse(
    id: string,
    rawInput: unknown,
    roles: Role[],
    actorId = 'system',
  ): Promise<Warehouse> {
    this.requireManager(roles);
    const input = updateWarehouseRequestSchema.parse(rawInput);
    const warehouse = await this.repository.updateWarehouse(id, input);
    await this.repository.writeAudit('inventory.warehouse.updated', actorId, {
      warehouseId: warehouse.id,
      code: warehouse.code,
      changes: input,
    });
    return warehouse;
  }

  async createStore(
    rawInput: unknown,
    roles: Role[],
    actorId = 'system',
  ): Promise<Store> {
    this.requireManager(roles);
    const input = createStoreRequestSchema.parse(rawInput);
    const store = await this.repository.createStore(input);
    await this.repository.writeAudit('inventory.store.created', actorId, {
      storeId: store.id,
      code: store.code,
      pickupEnabled: store.pickupEnabled,
    });
    return store;
  }

  listStores(): Promise<Store[]> {
    return this.repository.listStores();
  }

  listPickupStores(): Promise<Store[]> {
    return this.repository.listPickupStores();
  }

  async getStoreById(id: string): Promise<Store> {
    const store = await this.repository.getStoreById(id);
    if (!store) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy cửa hàng',
        details: { storeId: id },
      });
    }
    return store;
  }

  async updateStore(
    id: string,
    rawInput: unknown,
    roles: Role[],
    actorId = 'system',
  ): Promise<Store> {
    this.requireManager(roles);
    const input = updateStoreRequestSchema.parse(rawInput);
    const store = await this.repository.updateStore(id, input);
    await this.repository.writeAudit('inventory.store.updated', actorId, {
      storeId: store.id,
      code: store.code,
      changes: input,
    });
    return store;
  }

  async getStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem> {
    const stock = await this.repository.getStock(
      skuCode,
      locationType,
      locationId,
    );
    if (!stock) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy tồn kho',
        details: { skuCode, locationType, locationId },
      });
    }
    return stock;
  }

  listStock(filter: {
    skuCode?: string;
    locationType?: LocationType;
    locationId?: string;
  }): Promise<StockItem[]> {
    return this.repository.listStock(filter);
  }

  listLowStock(): Promise<StockItem[]> {
    return this.repository.listLowStock();
  }

  async getAvailability(rawQuery: {
    skuCode: string;
    quantity?: number | string;
    city?: string;
  }): Promise<StockSource[]> {
    const query = availabilityQuerySchema.parse(rawQuery);
    return this.repository.findSourcesForSku(
      query.skuCode,
      query.quantity,
      query.city,
    );
  }

  async selectSource(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<StockSource> {
    const sources = await this.repository.findSourcesForSku(
      skuCode,
      quantity,
      city,
    );
    const best = sources[0];
    if (!best) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_INSUFFICIENT,
        message: 'Không đủ tồn kho khả dụng cho sản phẩm',
        details: { skuCode, quantity },
      });
    }
    return best;
  }

  async listMovements(query: {
    skuCode?: string;
    page?: number | string;
    pageSize?: number | string;
  }) {
    const page = normalizePage(
      query.page !== undefined ? Number(query.page) : undefined,
    );
    const pageSize = normalizePageSize(
      query.pageSize !== undefined ? Number(query.pageSize) : undefined,
    );
    const result = await this.repository.listMovements({
      skuCode: query.skuCode,
      page,
      pageSize,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
    return {
      items: result.items,
      meta: { page, pageSize, totalItems: result.total, totalPages },
    };
  }

  async getReservationById(id: string): Promise<Reservation> {
    const reservation = await this.repository.getReservationById(id);
    if (!reservation) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_RESERVATION_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu giữ hàng',
      });
    }
    return reservation;
  }

  async receiveStock(
    rawInput: unknown,
    roles: Role[],
    actorId?: string,
  ): Promise<StockItem> {
    this.requireStaff(roles);
    const input = receiveStockRequestSchema.parse(rawInput);
    return this.withIdempotency(input.idempotencyKey, 'receive', async () => {
      const updated = await this.repository.receiveStock({
        skuCode: input.skuCode,
        locationType: input.locationType,
        locationId: input.locationId,
        quantity: input.quantity,
        actorId,
        note: input.note,
        referenceType: 'manual',
      });
      return updated;
    });
  }

  async issueStock(
    rawInput: unknown,
    roles: Role[],
    actorId?: string,
  ): Promise<StockItem> {
    this.requireStaff(roles);
    const input = issueStockRequestSchema.parse(rawInput);
    return this.withIdempotency(input.idempotencyKey, 'issue', async () => {
      const updated = await this.repository.issueStock({
        skuCode: input.skuCode,
        locationType: input.locationType,
        locationId: input.locationId,
        quantity: input.quantity,
        actorId,
        note: input.note,
        referenceType: 'manual',
      });
      await this.checkLowStock(
        input.skuCode,
        input.locationType,
        input.locationId,
      );
      return updated;
    });
  }

  async reserveStock(
    rawInput: unknown,
    roles: Role[],
    actorId?: string,
  ): Promise<Reservation> {
    this.requireStaff(roles);
    const input = reserveStockRequestSchema.parse(rawInput);
    return this.withIdempotency(input.idempotencyKey, 'reserve', async () => {
      const reservedLines: Array<{
        skuCode: string;
        locationType: LocationType;
        locationId: string;
        quantity: number;
      }> = [];

      try {
        for (const line of input.lines) {
          let locationType: LocationType;
          let locationId: string;

          if (line.preferredLocationType && line.preferredLocationId) {
            locationType = line.preferredLocationType;
            locationId = line.preferredLocationId;
            const stock = await this.repository.getStock(
              line.skuCode,
              locationType,
              locationId,
            );
            if (!stock || stock.available < line.quantity) {
              throw new AppError({
                errorCode: ErrorCodes.INVENTORY_INSUFFICIENT,
                message: 'Không đủ tồn kho khả dụng tại vị trí yêu cầu',
                details: { skuCode: line.skuCode, locationType, locationId },
              });
            }
          } else {
            const best = await this.selectSource(line.skuCode, line.quantity);
            locationType = best.locationType;
            locationId = best.locationId;
          }

          await this.repository.reserveStock({
            skuCode: line.skuCode,
            locationType,
            locationId,
            quantity: line.quantity,
            actorId,
            referenceType: 'reservation',
          });
          reservedLines.push({
            skuCode: line.skuCode,
            locationType,
            locationId,
            quantity: line.quantity,
          });
        }
      } catch (error) {
        for (const done of [...reservedLines].reverse()) {
          await this.repository
            .releaseStock({ ...done, actorId, referenceType: 'reservation' })
            .catch(() => undefined);
        }
        throw error;
      }

      const expiresAt = new Date(
        Date.now() + (input.expiresInSeconds ?? 900) * 1000,
      );
      const reservation = await this.repository.createReservation({
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId,
        expiresAt,
        lines: reservedLines,
      });

      await this.publish(
        createEventEnvelope({
          eventType: EventTypes.INVENTORY_RESERVATION_CREATED,
          producer: 'inventory-service',
          traceId: createTraceId(),
          payload: {
            reservationId: reservation.id,
            orderId: reservation.orderId,
            lines: reservedLines,
          },
        }),
      );

      for (const line of reservedLines) {
        await this.checkLowStock(
          line.skuCode,
          line.locationType,
          line.locationId,
        );
      }

      return reservation;
    });
  }

  async releaseReservation(
    id: string,
    roles: Role[],
    actorId?: string,
  ): Promise<Reservation> {
    this.requireStaff(roles);
    const reservation = await this.getReservationById(id);
    if (reservation.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_CONFLICT,
        message: 'Yêu cầu giữ hàng không ở trạng thái có thể hủy giữ',
        details: { reservationId: id, status: reservation.status },
      });
    }
    for (const line of reservation.lines) {
      await this.releaseLine(line, actorId, reservation.id);
    }
    const updated = await this.repository.updateReservationStatus(
      id,
      'RELEASED',
    );
    await this.publish(
      createEventEnvelope({
        eventType: EventTypes.INVENTORY_RESERVATION_RELEASED,
        producer: 'inventory-service',
        traceId: createTraceId(),
        payload: { reservationId: id },
      }),
    );
    return updated;
  }

  private async releaseLine(
    line: ReservationLine,
    actorId: string | undefined,
    reservationId: string,
  ): Promise<void> {
    await this.repository.releaseStock({
      skuCode: line.skuCode,
      locationType: line.locationType,
      locationId: line.locationId,
      quantity: line.quantity,
      actorId,
      referenceType: 'reservation',
      referenceId: reservationId,
    });
  }

  async commitReservation(
    id: string,
    roles: Role[],
    actorId?: string,
  ): Promise<Reservation> {
    this.requireStaff(roles);
    const reservation = await this.getReservationById(id);
    if (reservation.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_CONFLICT,
        message: 'Yêu cầu giữ hàng không ở trạng thái có thể xác nhận xuất',
        details: { reservationId: id, status: reservation.status },
      });
    }
    for (const line of reservation.lines) {
      await this.repository.commitStock({
        skuCode: line.skuCode,
        locationType: line.locationType,
        locationId: line.locationId,
        quantity: line.quantity,
        actorId,
        referenceType: 'reservation',
        referenceId: reservation.id,
      });
    }
    const updated = await this.repository.updateReservationStatus(
      id,
      'COMMITTED',
    );
    await this.publish(
      createEventEnvelope({
        eventType: EventTypes.INVENTORY_STOCK_COMMITTED,
        producer: 'inventory-service',
        traceId: createTraceId(),
        payload: { reservationId: id },
      }),
    );
    for (const line of reservation.lines) {
      await this.checkLowStock(
        line.skuCode,
        line.locationType,
        line.locationId,
      );
    }
    return updated;
  }

  async returnStock(
    input: ReturnStockRequestInput,
    roles: Role[],
  ): Promise<StockItem[]> {
    this.requireStaff(roles);
    let lines: ReturnStockLineInput[];
    let reservation: Reservation | null = null;

    if (input.reservationId) {
      reservation = await this.getReservationById(input.reservationId);
      lines = reservation.lines.map((line) => ({
        skuCode: line.skuCode,
        locationType: line.locationType,
        locationId: line.locationId,
        quantity: line.quantity,
      }));
    } else if (input.lines && input.lines.length > 0) {
      lines = input.lines;
    } else {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Cần cung cấp reservationId hoặc danh sách dòng hoàn trả',
      });
    }

    const results: StockItem[] = [];
    for (const line of lines) {
      const updated = await this.repository.returnStock({
        skuCode: line.skuCode,
        locationType: line.locationType,
        locationId: line.locationId,
        quantity: line.quantity,
        actorId: input.actorId,
        note: input.note,
        referenceType: reservation ? 'reservation' : 'manual',
        referenceId: reservation?.id,
      });
      results.push(updated);
    }

    await this.publish(
      createEventEnvelope({
        eventType: EventTypes.INVENTORY_STOCK_RETURNED,
        producer: 'inventory-service',
        traceId: createTraceId(),
        payload: { reservationId: reservation?.id, lines },
      }),
    );

    return results;
  }

  async transferStock(
    rawInput: unknown,
    roles: Role[],
    actorId?: string,
  ): Promise<Transfer> {
    this.requireStaff(roles);
    const input = transferStockRequestSchema.parse(rawInput);
    return this.withIdempotency(input.idempotencyKey, 'transfer', async () => {
      if (
        input.fromLocationType === input.toLocationType &&
        input.fromLocationId === input.toLocationId
      ) {
        throw new AppError({
          errorCode: ErrorCodes.INVENTORY_TRANSFER_INVALID,
          message: 'Vị trí nguồn và đích không được trùng nhau',
        });
      }

      const transfer = await this.repository.createTransfer({
        idempotencyKey: input.idempotencyKey,
        skuCode: input.skuCode,
        quantity: input.quantity,
        fromLocationType: input.fromLocationType,
        fromLocationId: input.fromLocationId,
        toLocationType: input.toLocationType,
        toLocationId: input.toLocationId,
        note: input.note,
      });

      await this.publish(
        createEventEnvelope({
          eventType: EventTypes.INVENTORY_TRANSFER_CREATED,
          producer: 'inventory-service',
          traceId: createTraceId(),
          payload: {
            transferId: transfer.id,
            skuCode: transfer.skuCode,
            quantity: transfer.quantity,
          },
        }),
      );

      await this.repository.transferOutStock({
        skuCode: input.skuCode,
        locationType: input.fromLocationType,
        locationId: input.fromLocationId,
        quantity: input.quantity,
        actorId,
        referenceType: 'transfer',
        referenceId: transfer.id,
      });
      await this.repository.transferInStock({
        skuCode: input.skuCode,
        locationType: input.toLocationType,
        locationId: input.toLocationId,
        quantity: input.quantity,
        actorId,
        referenceType: 'transfer',
        referenceId: transfer.id,
      });

      const completed = await this.repository.completeTransfer(transfer.id);
      await this.publish(
        createEventEnvelope({
          eventType: EventTypes.INVENTORY_TRANSFER_COMPLETED,
          producer: 'inventory-service',
          traceId: createTraceId(),
          payload: { transferId: completed.id },
        }),
      );

      await this.checkLowStock(
        input.skuCode,
        input.fromLocationType,
        input.fromLocationId,
      );

      return completed;
    });
  }

  async adjustStock(
    rawInput: unknown,
    roles: Role[],
    actorId = 'system',
  ): Promise<StockItem> {
    this.requireStaff(roles);
    const input = adjustStockRequestSchema.parse(rawInput);
    return this.withIdempotency(input.idempotencyKey, 'adjust', async () => {
      const updated = await this.repository.adjustStock({
        skuCode: input.skuCode,
        locationType: input.locationType,
        locationId: input.locationId,
        onHand: input.onHand,
        actorId,
        reason: input.reason,
      });
      await this.repository.writeAudit('inventory.stock.adjusted', actorId, {
        skuCode: input.skuCode,
        locationType: input.locationType,
        locationId: input.locationId,
        onHand: input.onHand,
        reason: input.reason,
      });
      await this.checkLowStock(
        input.skuCode,
        input.locationType,
        input.locationId,
      );
      return updated;
    });
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

export type { StockMovement };
