import type { LocationType } from '@nexatech/shared-contracts';

export type { LocationType };

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'COMMITTED' | 'EXPIRED';

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type MovementType =
  | 'IN'
  | 'OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'COMMIT'
  | 'RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUST';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  warehouseId?: string;
  address?: string;
  city?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockItem {
  id: string;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  onHand: number;
  reserved: number;
  /** available = onHand - reserved, computed in application layer */
  available: number;
  version: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

export interface ReservationLine {
  id: string;
  reservationId: string;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  idempotencyKey: string;
  orderId?: string;
  status: ReservationStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lines: ReservationLine[];
}

export interface StockMovement {
  id: string;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  type: MovementType;
  quantity: number;
  balanceOnHand: number;
  balanceReserved: number;
  referenceType?: string;
  referenceId?: string;
  actorId?: string;
  note?: string;
  createdAt: Date;
}

export interface Transfer {
  id: string;
  idempotencyKey: string;
  skuCode: string;
  quantity: number;
  fromLocationType: LocationType;
  fromLocationId: string;
  toLocationType: LocationType;
  toLocationId: string;
  status: TransferStatus;
  note?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  responseJson: unknown;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface StockSource {
  locationType: LocationType;
  locationId: string;
  code: string;
  name: string;
  city?: string;
  available: number;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  address?: string;
  isActive?: boolean;
}

export interface CreateStoreInput {
  code: string;
  name: string;
  warehouseId?: string;
  address?: string;
  city?: string;
  isActive?: boolean;
}

export interface StockFilter {
  skuCode?: string;
  locationType?: LocationType;
  locationId?: string;
}

export interface StockMutationParams {
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity: number;
  actorId?: string;
  note?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface AdjustStockParams {
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  onHand: number;
  actorId?: string;
  reason?: string;
}

export interface AddMovementInput {
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  type: MovementType;
  quantity: number;
  balanceOnHand: number;
  balanceReserved: number;
  referenceType?: string;
  referenceId?: string;
  actorId?: string;
  note?: string;
}

export interface ListMovementsFilter {
  skuCode?: string;
  page: number;
  pageSize: number;
}

export interface ReservationLineInput {
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity: number;
}

export interface CreateReservationInput {
  idempotencyKey: string;
  orderId?: string;
  expiresAt?: Date;
  lines: ReservationLineInput[];
}

export interface CreateTransferInput {
  idempotencyKey: string;
  skuCode: string;
  quantity: number;
  fromLocationType: LocationType;
  fromLocationId: string;
  toLocationType: LocationType;
  toLocationId: string;
  note?: string;
}

export interface ReserveLineRequest {
  skuCode: string;
  quantity: number;
  preferredLocationType?: LocationType;
  preferredLocationId?: string;
}

export interface ReserveStockRequestInput {
  idempotencyKey: string;
  orderId?: string;
  lines: ReserveLineRequest[];
  expiresInSeconds?: number;
  actorId?: string;
}

export interface ReturnStockLineInput {
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity: number;
}

export interface ReturnStockRequestInput {
  reservationId?: string;
  lines?: ReturnStockLineInput[];
  actorId?: string;
  note?: string;
}
