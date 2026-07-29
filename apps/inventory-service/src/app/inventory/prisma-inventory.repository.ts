import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes, type ErrorCode } from '@nexatech/shared-errors';
import type {
  Prisma,
  Reservation as PrismaReservation,
  ReservationLine as PrismaReservationLine,
  Store as PrismaStore,
  StockItem as PrismaStockItem,
  StockMovement as PrismaStockMovement,
  Transfer as PrismaTransfer,
  Warehouse as PrismaWarehouse,
} from '../../generated/prisma';
import type { InventoryRepository } from './inventory.repository';
import type {
  AddMovementInput,
  AdjustStockParams,
  CreateReservationInput,
  CreateStoreInput,
  CreateTransferInput,
  CreateWarehouseInput,
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
import { PrismaService } from './prisma.service';

const MAX_OPTIMISTIC_ATTEMPTS = 3;

function defaultLowStockThreshold(): number {
  const raw = process.env['INVENTORY_LOW_STOCK_THRESHOLD'];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

function toWarehouse(row: PrismaWarehouse): Warehouse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toStore(row: PrismaStore): Store {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    warehouseId: row.warehouseId ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toStockItem(row: PrismaStockItem): StockItem {
  return {
    id: row.id,
    skuCode: row.skuCode,
    locationType: row.locationType as LocationType,
    locationId: row.locationId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.onHand - row.reserved,
    version: row.version,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.updatedAt,
  };
}

function toMovement(row: PrismaStockMovement): StockMovement {
  return {
    id: row.id,
    skuCode: row.skuCode,
    locationType: row.locationType as LocationType,
    locationId: row.locationId,
    type: row.type,
    quantity: row.quantity,
    balanceOnHand: row.balanceOnHand,
    balanceReserved: row.balanceReserved,
    referenceType: row.referenceType ?? undefined,
    referenceId: row.referenceId ?? undefined,
    actorId: row.actorId ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

function toReservation(
  row: PrismaReservation & { lines: PrismaReservationLine[] },
): Reservation {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    orderId: row.orderId ?? undefined,
    status: row.status as ReservationStatus,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((line) => ({
      id: line.id,
      reservationId: line.reservationId,
      skuCode: line.skuCode,
      locationType: line.locationType as LocationType,
      locationId: line.locationId,
      quantity: line.quantity,
    })),
  };
}

function toTransfer(row: PrismaTransfer): Transfer {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    skuCode: row.skuCode,
    quantity: row.quantity,
    fromLocationType: row.fromLocationType as LocationType,
    fromLocationId: row.fromLocationId,
    toLocationType: row.toLocationType as LocationType,
    toLocationId: row.toLocationId,
    status: row.status,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };
}

type StockMutationResult =
  | { conflict: true }
  | { conflict: false; stock: PrismaStockItem };

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private handleUniqueCode(
    error: unknown,
    message: string,
    code: string,
  ): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message,
        details: { code },
      });
    }
  }

  private handleUniqueIdempotency(error: unknown, message: string): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_IDEMPOTENCY_CONFLICT,
        message,
      });
    }
  }

  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    try {
      const row = await this.prisma.warehouse.create({
        data: {
          code: input.code,
          name: input.name,
          address: input.address,
          isActive: input.isActive ?? true,
        },
      });
      return toWarehouse(row);
    } catch (error) {
      this.handleUniqueCode(error, 'Mã kho đã tồn tại', input.code);
      throw error;
    }
  }

  async listWarehouses(): Promise<Warehouse[]> {
    const rows = await this.prisma.warehouse.findMany({
      orderBy: { code: 'asc' },
    });
    return rows.map(toWarehouse);
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    const row = await this.prisma.warehouse.findUnique({ where: { id } });
    return row ? toWarehouse(row) : null;
  }

  async createStore(input: CreateStoreInput): Promise<Store> {
    if (input.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: input.warehouseId },
      });
      if (!warehouse) {
        throw new AppError({
          errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
          message: 'Không tìm thấy kho',
        });
      }
    }
    try {
      const row = await this.prisma.store.create({
        data: {
          code: input.code,
          name: input.name,
          warehouseId: input.warehouseId,
          address: input.address,
          city: input.city,
          isActive: input.isActive ?? true,
        },
      });
      return toStore(row);
    } catch (error) {
      this.handleUniqueCode(error, 'Mã cửa hàng đã tồn tại', input.code);
      throw error;
    }
  }

  async listStores(): Promise<Store[]> {
    const rows = await this.prisma.store.findMany({ orderBy: { code: 'asc' } });
    return rows.map(toStore);
  }

  async getStoreById(id: string): Promise<Store | null> {
    const row = await this.prisma.store.findUnique({ where: { id } });
    return row ? toStore(row) : null;
  }

  private async ensureStockRow(
    tx: Prisma.TransactionClient,
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<PrismaStockItem> {
    const existing = await tx.stockItem.findUnique({
      where: {
        skuCode_locationType_locationId: { skuCode, locationType, locationId },
      },
    });
    if (existing) {
      return existing;
    }
    try {
      return await tx.stockItem.create({
        data: {
          skuCode,
          locationType,
          locationId,
          onHand: 0,
          reserved: 0,
          version: 0,
          lowStockThreshold: defaultLowStockThreshold(),
        },
      });
    } catch {
      const row = await tx.stockItem.findUnique({
        where: {
          skuCode_locationType_locationId: {
            skuCode,
            locationType,
            locationId,
          },
        },
      });
      if (row) {
        return row;
      }
      throw new AppError({
        errorCode: ErrorCodes.INTERNAL_ERROR,
        message: 'Không thể khởi tạo tồn kho',
      });
    }
  }

  async getOrCreateStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem> {
    const row = await this.prisma.$transaction((tx) =>
      this.ensureStockRow(tx, skuCode, locationType, locationId),
    );
    return toStockItem(row);
  }

  async getStock(
    skuCode: string,
    locationType: LocationType,
    locationId: string,
  ): Promise<StockItem | null> {
    const row = await this.prisma.stockItem.findUnique({
      where: {
        skuCode_locationType_locationId: { skuCode, locationType, locationId },
      },
    });
    return row ? toStockItem(row) : null;
  }

  async listStock(filter: StockFilter): Promise<StockItem[]> {
    const rows = await this.prisma.stockItem.findMany({
      where: {
        skuCode: filter.skuCode,
        locationType: filter.locationType,
        locationId: filter.locationId,
      },
    });
    return rows.map(toStockItem);
  }

  async listLowStock(): Promise<StockItem[]> {
    const rows = await this.prisma.$queryRaw<PrismaStockItem[]>`
      SELECT * FROM "StockItem"
      WHERE "onHand" - "reserved" <= "lowStockThreshold"
      ORDER BY ("onHand" - "reserved") ASC
    `;
    return rows.map(toStockItem);
  }

  private async mutateStock(
    params: StockMutationParams,
    type: StockMovement['type'],
    compute: (row: PrismaStockItem) => { onHand: number; reserved: number },
    errorCode: ErrorCode,
    insufficientMessage: string,
  ): Promise<StockItem> {
    for (let attempt = 1; attempt <= MAX_OPTIMISTIC_ATTEMPTS; attempt += 1) {
      const result = await this.prisma.$transaction(
        async (tx): Promise<StockMutationResult> => {
          const row = await this.ensureStockRow(
            tx,
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
          const updateResult = await tx.stockItem.updateMany({
            where: { id: row.id, version: row.version },
            data: { onHand, reserved, version: { increment: 1 } },
          });
          if (updateResult.count === 0) {
            return { conflict: true };
          }
          await tx.stockMovement.create({
            data: {
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
            },
          });
          const updated = await tx.stockItem.findUniqueOrThrow({
            where: { id: row.id },
          });
          return { conflict: false, stock: updated };
        },
      );
      if (!result.conflict) {
        return toStockItem(result.stock);
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.INVENTORY_CONFLICT,
      message: 'Xung đột phiên bản tồn kho, vui lòng thử lại',
      details: {
        skuCode: params.skuCode,
        locationType: params.locationType,
        locationId: params.locationId,
      },
    });
  }

  async receiveStock(params: StockMutationParams): Promise<StockItem> {
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    return this.mutateStock(
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
    for (let attempt = 1; attempt <= MAX_OPTIMISTIC_ATTEMPTS; attempt += 1) {
      const result = await this.prisma.$transaction(
        async (tx): Promise<StockMutationResult> => {
          const row = await this.ensureStockRow(
            tx,
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
          const updateResult = await tx.stockItem.updateMany({
            where: { id: row.id, version: row.version },
            data: { onHand: params.onHand, version: { increment: 1 } },
          });
          if (updateResult.count === 0) {
            return { conflict: true };
          }
          await tx.stockMovement.create({
            data: {
              skuCode: params.skuCode,
              locationType: params.locationType,
              locationId: params.locationId,
              type: 'ADJUST',
              quantity: delta,
              balanceOnHand: params.onHand,
              balanceReserved: row.reserved,
              referenceType: 'stocktake',
              actorId: params.actorId,
              note: params.reason,
            },
          });
          const updated = await tx.stockItem.findUniqueOrThrow({
            where: { id: row.id },
          });
          return { conflict: false, stock: updated };
        },
      );
      if (!result.conflict) {
        return toStockItem(result.stock);
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.INVENTORY_CONFLICT,
      message: 'Xung đột phiên bản tồn kho, vui lòng thử lại',
      details: { skuCode: params.skuCode },
    });
  }

  async addMovement(input: AddMovementInput): Promise<StockMovement> {
    const row = await this.prisma.stockMovement.create({
      data: {
        skuCode: input.skuCode,
        locationType: input.locationType,
        locationId: input.locationId,
        type: input.type,
        quantity: input.quantity,
        balanceOnHand: input.balanceOnHand,
        balanceReserved: input.balanceReserved,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        actorId: input.actorId,
        note: input.note,
      },
    });
    return toMovement(row);
  }

  async listMovements(
    filter: ListMovementsFilter,
  ): Promise<{ items: StockMovement[]; total: number }> {
    const where = filter.skuCode ? { skuCode: filter.skuCode } : {};
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items: rows.map(toMovement), total };
  }

  async createReservation(input: CreateReservationInput): Promise<Reservation> {
    try {
      const row = await this.prisma.reservation.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          expiresAt: input.expiresAt,
          lines: {
            create: input.lines.map((line) => ({
              skuCode: line.skuCode,
              locationType: line.locationType,
              locationId: line.locationId,
              quantity: line.quantity,
            })),
          },
        },
        include: { lines: true },
      });
      return toReservation(row);
    } catch (error) {
      this.handleUniqueIdempotency(error, 'Yêu cầu giữ hàng đã tồn tại');
      throw error;
    }
  }

  async getReservationById(id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? toReservation(row) : null;
  }

  async getReservationByIdempotencyKey(
    key: string,
  ): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { idempotencyKey: key },
      include: { lines: true },
    });
    return row ? toReservation(row) : null;
  }

  async updateReservationStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<Reservation> {
    try {
      const row = await this.prisma.reservation.update({
        where: { id },
        data: { status },
        include: { lines: true },
      });
      return toReservation(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_RESERVATION_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu giữ hàng',
      });
    }
  }

  async createTransfer(input: CreateTransferInput): Promise<Transfer> {
    try {
      const row = await this.prisma.transfer.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          skuCode: input.skuCode,
          quantity: input.quantity,
          fromLocationType: input.fromLocationType,
          fromLocationId: input.fromLocationId,
          toLocationType: input.toLocationType,
          toLocationId: input.toLocationId,
          note: input.note,
        },
      });
      return toTransfer(row);
    } catch (error) {
      this.handleUniqueIdempotency(error, 'Yêu cầu điều chuyển đã tồn tại');
      throw error;
    }
  }

  async completeTransfer(id: string): Promise<Transfer> {
    try {
      const row = await this.prisma.transfer.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return toTransfer(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.INVENTORY_NOT_FOUND,
        message: 'Không tìm thấy yêu cầu điều chuyển',
      });
    }
  }

  async getTransferByIdempotencyKey(key: string): Promise<Transfer | null> {
    const row = await this.prisma.transfer.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? toTransfer(row) : null;
  }

  async findIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });
    return row
      ? {
          key: row.key,
          operation: row.operation,
          responseJson: row.responseJson,
          createdAt: row.createdAt,
        }
      : null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    const responseJson = response as Prisma.InputJsonValue;
    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      create: { key, operation, responseJson },
      update: { operation, responseJson },
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: createId(),
        action,
        actorId,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findSourcesForSku(
    skuCode: string,
    quantity: number,
    city?: string,
  ): Promise<StockSource[]> {
    const rows = await this.prisma.stockItem.findMany({ where: { skuCode } });
    const candidates = rows.filter(
      (row) => row.onHand - row.reserved >= quantity,
    );

    const warehouseIds = candidates
      .filter((row) => row.locationType === 'warehouse')
      .map((row) => row.locationId);
    const storeIds = candidates
      .filter((row) => row.locationType === 'store')
      .map((row) => row.locationId);

    const [warehouses, stores] = await Promise.all([
      warehouseIds.length
        ? this.prisma.warehouse.findMany({
            where: { id: { in: warehouseIds } },
          })
        : Promise.resolve([]),
      storeIds.length
        ? this.prisma.store.findMany({ where: { id: { in: storeIds } } })
        : Promise.resolve([]),
    ]);
    const warehouseMap = new Map(warehouses.map((row) => [row.id, row]));
    const storeMap = new Map(stores.map((row) => [row.id, row]));

    const sources: StockSource[] = [];
    for (const row of candidates) {
      const available = row.onHand - row.reserved;
      if (row.locationType === 'warehouse') {
        const warehouse = warehouseMap.get(row.locationId);
        if (!warehouse) {
          continue;
        }
        sources.push({
          locationType: 'warehouse',
          locationId: row.locationId,
          code: warehouse.code,
          name: warehouse.name,
          available,
        });
      } else {
        const store = storeMap.get(row.locationId);
        if (!store) {
          continue;
        }
        sources.push({
          locationType: 'store',
          locationId: row.locationId,
          code: store.code,
          name: store.name,
          city: store.city ?? undefined,
          available,
        });
      }
    }

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
