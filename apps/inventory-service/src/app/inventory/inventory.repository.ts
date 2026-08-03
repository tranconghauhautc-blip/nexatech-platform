import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes, type ErrorCode } from '@nexatech/shared-errors';
import type {
  AddMovementInput,
  AdjustStockParams,
  AuditLog,
  CreateReservationInput,
  CreateStoreInput,
  CreateTransferInput,
  CreateWarehouseInput,
  UpdateStoreInput,
  UpdateWarehouseInput,
  IdempotencyRecord,
  ListMovementsFilter,
  LocationType,
  Reservation,
  ReservationStatus,
  Store,
  StockFilter,
  StockItem,
  StockMovement,
  StockMutationParams,
  StockSource,
  Transfer,
  Warehouse,
} from './inventory.types';

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

export interface InventoryRepository {
  createWarehouse(input: CreateWarehouseInput): Promise<Warehouse>;
  listWarehouses(): Promise<Warehouse[]>;
  getWarehouseById(id: string): Promise<Warehouse | null>;
  updateWarehouse(id: string, input: UpdateWarehouseInput): Promise<Warehouse>;

  createStore(input: CreateStoreInput): Promise<Store>;
  listStores(): Promise<Store[]>;
  listPickupStores(): Promise<Store[]>;
  getStoreById(id: string): Promise<Store | null>;
  updateStore(id: string, input: UpdateStoreInput): Promise<Store>;

  getOrCreateStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem>;
  getStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem | null>;
  listStock(filter: StockFilter): Promise<StockItem[]>;
  listLowStock(): Promise<StockItem[]>;

  receiveStock(params: StockMutationParams): Promise<StockItem>;
  issueStock(params: StockMutationParams): Promise<StockItem>;
  reserveStock(params: StockMutationParams): Promise<StockItem>;
  releaseStock(params: StockMutationParams): Promise<StockItem>;
  commitStock(params: StockMutationParams): Promise<StockItem>;
  returnStock(params: StockMutationParams): Promise<StockItem>;
  transferOutStock(params: StockMutationParams): Promise<StockItem>;
  transferInStock(params: StockMutationParams): Promise<StockItem>;
  adjustStock(params: AdjustStockParams): Promise<StockItem>;

  addMovement(input: AddMovementInput): Promise<StockMovement>;
  listMovements(
    filter: ListMovementsFilter,
  ): Promise<{ items: StockMovement[]; total: number }>;

  createReservation(input: CreateReservationInput): Promise<Reservation>;
  getReservationById(id: string): Promise<Reservation | null>;
  getReservationByIdempotencyKey(key: string): Promise<Reservation | null>;
  updateReservationStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<Reservation>;

  createTransfer(input: CreateTransferInput): Promise<Transfer>;
  completeTransfer(id: string): Promise<Transfer>;
  getTransferByIdempotencyKey(key: string): Promise<Transfer | null>;

  findIdempotency(key: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void>;

  writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;

  findSourcesForSku(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<StockSource[]>;
}

function defaultLowStockThreshold(): number {
  const raw = process.env['INVENTORY_LOW_STOCK_THRESHOLD'];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

function stockKey(
  skuCode: string,
  locationType: LocationType,
  locationId: string,
): string {
  return `${skuCode}|${locationType}|${locationId}`;
}

interface InternalStockRow {
  id: string;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  onHand: number;
  reserved: number;
  version: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

function toStockItem(row: InternalStockRow): StockItem {
  return {
    id: row.id,
    skuCode: row.skuCode,
    locationType: row.locationType,
    locationId: row.locationId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.onHand - row.reserved,
    version: row.version,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.updatedAt,
  };
}

export class InMemoryInventoryRepository implements InventoryRepository {
  private warehouses = new Map<string, Warehouse>();
  private warehouseCodes = new Set<string>();
  private stores = new Map<string, Store>();
  private storeCodes = new Set<string>();
  private stockItems = new Map<string, InternalStockRow>();
  private stockIndex = new Map<string, string>();
  private reservations = new Map<string, Reservation>();
  private reservationsByKey = new Map<string, string>();
  private movements: StockMovement[] = [];
  private transfers = new Map<string, Transfer>();
  private transfersByKey = new Map<string, string>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private auditLogs: AuditLog[] = [];

  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    if (this.warehouseCodes.has(input.code)) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Mã kho đã tồn tại',
        details: { code: input.code },
      });
    }
    const now = new Date();
    const warehouse: Warehouse = {
      id: createId(),
      code: input.code,
      name: input.name,
      address: input.address,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.warehouses.set(warehouse.id, warehouse);
    this.warehouseCodes.add(warehouse.code);
    return warehouse;
  }

  async listWarehouses(): Promise<Warehouse[]> {
    return [...this.warehouses.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) ?? null;
  }

  async updateWarehouse(
    id: string,
    input: UpdateWarehouseInput,
  ): Promise<Warehouse> {
    const existing = this.warehouses.get(id);
    if (!existing) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy kho',
      });
    }
    const updated: Warehouse = {
      ...existing,
      name: input.name ?? existing.name,
      address:
        input.address === undefined
          ? existing.address
          : (input.address ?? undefined),
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date(),
    };
    this.warehouses.set(id, updated);
    return updated;
  }

  async createStore(input: CreateStoreInput): Promise<Store> {
    if (this.storeCodes.has(input.code)) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Mã cửa hàng đã tồn tại',
        details: { code: input.code },
      });
    }
    if (input.warehouseId && !this.warehouses.has(input.warehouseId)) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy kho',
      });
    }
    const now = new Date();
    const store: Store = {
      id: createId(),
      code: input.code,
      name: input.name,
      warehouseId: input.warehouseId,
      address: input.address,
      city: input.city,
      phone: input.phone,
      openingHours: input.openingHours,
      pickupEnabled: input.pickupEnabled ?? false,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.stores.set(store.id, store);
    this.storeCodes.add(store.code);
    return store;
  }

  async listStores(): Promise<Store[]> {
    return [...this.stores.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }

  async listPickupStores(): Promise<Store[]> {
    return (await this.listStores()).filter(
      (s) => s.isActive && s.pickupEnabled,
    );
  }

  async getStoreById(id: string): Promise<Store | null> {
    return this.stores.get(id) ?? null;
  }

  async updateStore(id: string, input: UpdateStoreInput): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy cửa hàng',
      });
    }
    if (input.warehouseId) {
      if (!this.warehouses.has(input.warehouseId)) {
        throw new AppError({
          errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
          message: 'Không tìm thấy kho',
        });
      }
    }
    const updated: Store = {
      ...existing,
      name: input.name ?? existing.name,
      warehouseId:
        input.warehouseId === undefined
          ? existing.warehouseId
          : (input.warehouseId ?? undefined),
      address:
        input.address === undefined
          ? existing.address
          : (input.address ?? undefined),
      city:
        input.city === undefined ? existing.city : (input.city ?? undefined),
      phone:
        input.phone === undefined ? existing.phone : (input.phone ?? undefined),
      openingHours:
        input.openingHours === undefined
          ? existing.openingHours
          : (input.openingHours ?? undefined),
      pickupEnabled: input.pickupEnabled ?? existing.pickupEnabled,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date(),
    };
    this.stores.set(id, updated);
    return updated;
  }

  private findRow(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): InternalStockRow | null {
    const id = this.stockIndex.get(stockKey(skuCode, locationType, locationId));
    return id ? (this.stockItems.get(id) ?? null) : null;
  }

  private ensureRow(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): InternalStockRow {
    const existing = this.findRow(skuCode, locationType, locationId);
    if (existing) {
      return existing;
    }
    const row: InternalStockRow = {
      id: createId(),
      skuCode,
      locationType,
      locationId,
      onHand: 0,
      reserved: 0,
      version: 0,
      lowStockThreshold: defaultLowStockThreshold(),
      updatedAt: new Date(),
    };
    this.stockItems.set(row.id, row);
    this.stockIndex.set(stockKey(skuCode, locationType, locationId), row.id);
    return row;
  }

  async getOrCreateStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem> {
    return toStockItem(this.ensureRow(skuCode, locationType, locationId));
  }

  async getStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem | null> {
    const row = this.findRow(skuCode, locationType, locationId);
    return row ? toStockItem(row) : null;
  }

  async listStock(filter: StockFilter): Promise<StockItem[]> {
    return [...this.stockItems.values()]
      .filter((row) => !filter.skuCode || row.skuCode === filter.skuCode)
      .filter(
        (row) =>
          !filter.locationType || row.locationType === filter.locationType,
      )
      .filter(
        (row) => !filter.locationId || row.locationId === filter.locationId,
      )
      .map(toStockItem);
  }

  async listLowStock(): Promise<StockItem[]> {
    return [...this.stockItems.values()]
      .filter((row) => row.onHand - row.reserved <= row.lowStockThreshold)
      .map(toStockItem)
      .sort((a, b) => a.available - b.available);
  }

  private mutate(
    params: StockMutationParams,
    type:
      | 'IN'
      | 'OUT'
      | 'RESERVE'
      | 'RELEASE'
      | 'COMMIT'
      | 'RETURN'
      | 'TRANSFER_OUT'
      | 'TRANSFER_IN',
    compute: (row: InternalStockRow) => { onHand: number; reserved: number },
    errorCode: ErrorCode,
    insufficientMessage: string,
  ): StockItem {
    const row = this.ensureRow(
      params.skuCode,
      params.locationType,
      params.locationId,
    );
    const { onHand, reserved } = compute(row);
    if (onHand < 0 || reserved < 0 || reserved > onHand) {
      throw new AppError({
        errorCode,
        message: insufficientMessage,
        details: {
          skuCode: params.skuCode,
          locationType: params.locationType,
          locationId: params.locationId,
        },
      });
    }
    row.onHand = onHand;
    row.reserved = reserved;
    row.version += 1;
    row.updatedAt = new Date();
    this.movements.push({
      id: createId(),
      skuCode: params.skuCode,
      locationType: params.locationType,
      locationId: params.locationId,
      type,
      quantity: params.quantity,
      balanceOnHand: onHand,
      balanceReserved: reserved,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      actorId: params.actorId,
      note: params.note,
      createdAt: new Date(),
    });
    return toStockItem(row);
  }

  async receiveStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'IN',
      (row) => ({
        onHand: row.onHand + params.quantity,
        reserved: row.reserved,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Số lượng nhập kho không hợp lệ',
    );
  }

  async issueStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'OUT',
      (row) => ({
        onHand: row.onHand - params.quantity,
        reserved: row.reserved,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Không đủ tồn kho khả dụng để xuất kho',
    );
  }

  async reserveStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'RESERVE',
      (row) => ({
        onHand: row.onHand,
        reserved: row.reserved + params.quantity,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Không đủ tồn kho khả dụng để giữ hàng',
    );
  }

  async releaseStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'RELEASE',
      (row) => ({
        onHand: row.onHand,
        reserved: row.reserved - params.quantity,
      }),
      ErrorCodes.INVENTORY_CONFLICT,
      'Số lượng giữ hàng không đủ để hủy giữ',
    );
  }

  async commitStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'COMMIT',
      (row) => ({
        onHand: row.onHand - params.quantity,
        reserved: row.reserved - params.quantity,
      }),
      ErrorCodes.INVENTORY_CONFLICT,
      'Số lượng giữ hàng không đủ để xác nhận xuất kho',
    );
  }

  async returnStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'RETURN',
      (row) => ({
        onHand: row.onHand + params.quantity,
        reserved: row.reserved,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Số lượng hoàn trả không hợp lệ',
    );
  }

  async transferOutStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'TRANSFER_OUT',
      (row) => ({
        onHand: row.onHand - params.quantity,
        reserved: row.reserved,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Không đủ tồn kho khả dụng để điều chuyển',
    );
  }

  async transferInStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutate(
      params,
      'TRANSFER_IN',
      (row) => ({
        onHand: row.onHand + params.quantity,
        reserved: row.reserved,
      }),
      ErrorCodes.INVENTORY_INSUFFICIENT,
      'Số lượng điều chuyển đến không hợp lệ',
    );
  }

  async adjustStock(params: AdjustStockParams): Promise<StockItem> {
    const row = this.ensureRow(
      params.skuCode,
      params.locationType,
      params.locationId,
    );
    if (params.onHand < row.reserved) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_CONFLICT,
        message: 'Không thể đặt tồn kho thấp hơn số lượng đã giữ',
        details: {
          skuCode: params.skuCode,
          locationType: params.locationType,
          locationId: params.locationId,
          reserved: row.reserved,
        },
      });
    }
    const delta = params.onHand - row.onHand;
    row.onHand = params.onHand;
    row.version += 1;
    row.updatedAt = new Date();
    this.movements.push({
      id: createId(),
      skuCode: params.skuCode,
      locationType: params.locationType,
      locationId: params.locationId,
      type: 'ADJUST',
      quantity: delta,
      balanceOnHand: row.onHand,
      balanceReserved: row.reserved,
      referenceType: 'stocktake',
      actorId: params.actorId,
      note: params.reason,
      createdAt: new Date(),
    });
    return toStockItem(row);
  }

  async addMovement(input: AddMovementInput): Promise<StockMovement> {
    const movement: StockMovement = {
      id: createId(),
      ...input,
      createdAt: new Date(),
    };
    this.movements.push(movement);
    return movement;
  }

  async listMovements(
    filter: ListMovementsFilter,
  ): Promise<{ items: StockMovement[]; total: number }> {
    const filtered = this.movements
      .filter((m) => !filter.skuCode || m.skuCode === filter.skuCode)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (filter.page - 1) * filter.pageSize;
    return {
      items: filtered.slice(start, start + filter.pageSize),
      total: filtered.length,
    };
  }

  async createReservation(input: CreateReservationInput): Promise<Reservation> {
    if (this.reservationsByKey.has(input.idempotencyKey)) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_IDEMPOTENCY_CONFLICT,
        message: 'Yêu cầu giữ hàng đã tồn tại',
      });
    }
    const now = new Date();
    const reservationId = createId();
    const reservation: Reservation = {
      id: reservationId,
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId,
      status: 'ACTIVE',
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      lines: input.lines.map((line) => ({
        id: createId(),
        reservationId,
        skuCode: line.skuCode,
        locationType: line.locationType,
        locationId: line.locationId,
        quantity: line.quantity,
      })),
    };
    this.reservations.set(reservation.id, reservation);
    this.reservationsByKey.set(reservation.idempotencyKey, reservation.id);
    return reservation;
  }

  async getReservationById(id: string): Promise<Reservation | null> {
    return this.reservations.get(id) ?? null;
  }

  async getReservationByIdempotencyKey(
    key: string,
  ): Promise<Reservation | null> {
    const id = this.reservationsByKey.get(key);
    return id ? (this.reservations.get(id) ?? null) : null;
  }

  async updateReservationStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<Reservation> {
    const reservation = this.reservations.get(id);
    if (!reservation) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_RESERVATION_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu giữ hàng',
      });
    }
    const updated: Reservation = {
      ...reservation,
      status,
      updatedAt: new Date(),
    };
    this.reservations.set(id, updated);
    return updated;
  }

  async createTransfer(input: CreateTransferInput): Promise<Transfer> {
    if (this.transfersByKey.has(input.idempotencyKey)) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_IDEMPOTENCY_CONFLICT,
        message: 'Yêu cầu điều chuyển đã tồn tại',
      });
    }
    const transfer: Transfer = {
      id: createId(),
      idempotencyKey: input.idempotencyKey,
      skuCode: input.skuCode,
      quantity: input.quantity,
      fromLocationType: input.fromLocationType,
      fromLocationId: input.fromLocationId,
      toLocationType: input.toLocationType,
      toLocationId: input.toLocationId,
      status: 'PENDING',
      note: input.note,
      createdAt: new Date(),
    };
    this.transfers.set(transfer.id, transfer);
    this.transfersByKey.set(transfer.idempotencyKey, transfer.id);
    return transfer;
  }

  async completeTransfer(id: string): Promise<Transfer> {
    const transfer = this.transfers.get(id);
    if (!transfer) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu điều chuyển',
      });
    }
    const updated: Transfer = {
      ...transfer,
      status: 'COMPLETED',
      completedAt: new Date(),
    };
    this.transfers.set(id, updated);
    return updated;
  }

  async getTransferByIdempotencyKey(key: string): Promise<Transfer | null> {
    const id = this.transfersByKey.get(key);
    return id ? (this.transfers.get(id) ?? null) : null;
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | null> {
    return this.idempotency.get(key) ?? null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    this.idempotency.set(key, {
      key,
      operation,
      responseJson: response,
      createdAt: new Date(),
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    this.auditLogs.push({
      id: createId(),
      action,
      actorId,
      details,
      createdAt: new Date(),
    });
  }

  async findSourcesForSku(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<StockSource[]> {
    const candidates = [...this.stockItems.values()].filter(
      (row) => row.skuCode === skuCode && row.onHand - row.reserved >= quantity,
    );

    const toSource = (row: InternalStockRow): StockSource | null => {
      if (row.locationType === 'warehouse') {
        const warehouse = this.warehouses.get(row.locationId);
        if (!warehouse) {
          return null;
        }
        return {
          locationType: 'warehouse',
          locationId: row.locationId,
          code: warehouse.code,
          name: warehouse.name,
          available: row.onHand - row.reserved,
        };
      }
      const store = this.stores.get(row.locationId);
      if (!store) {
        return null;
      }
      return {
        locationType: 'store',
        locationId: row.locationId,
        code: store.code,
        name: store.name,
        city: store.city,
        available: row.onHand - row.reserved,
      };
    };

    const sources = candidates
      .map(toSource)
      .filter((source): source is StockSource => source !== null);

    const storesInCity = city
      ? sources.filter((s) => s.locationType === 'store' && s.city === city)
      : [];
    const warehouseSources = sources.filter(
      (s) => s.locationType === 'warehouse',
    );
    const otherStores = sources.filter(
      (s) => s.locationType === 'store' && !storesInCity.includes(s),
    );

    const byAvailableDesc = (a: StockSource, b: StockSource) =>
      b.available - a.available;

    return [
      ...storesInCity.sort(byAvailableDesc),
      ...warehouseSources.sort(byAvailableDesc),
      ...otherStores.sort(byAvailableDesc),
    ];
  }
}
