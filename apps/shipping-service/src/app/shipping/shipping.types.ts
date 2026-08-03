import type {
  DeliveryMethod,
  ShipmentStatus,
  ShippingProviderCode,
} from '@nexatech/shared-contracts';

export type { DeliveryMethod, ShipmentStatus, ShippingProviderCode };

export type QuoteStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';
export type SlotReservationStatus = 'HELD' | 'RELEASED' | 'CONSUMED';
export type CallbackStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

export interface PackageFee {
  packageId: string;
  fee: number;
}

export interface ShippingQuote {
  id: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  currency: string;
  totalFee: number;
  packageFees: PackageFee[];
  provider: ShippingProviderCode;
  expiresAt: Date;
  snapshotJson: Record<string, unknown>;
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliverySlot {
  id: string;
  deliveryDate: Date;
  windowStart: string;
  windowEnd: string;
  deliveryMethod: DeliveryMethod;
  locationType: string;
  locationId: string;
  capacity: number;
  reservedCount: number;
  cutoffAt: Date;
  timezone: string;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotReservation {
  id: string;
  slotId: string;
  orderId?: string;
  shipmentId?: string;
  customerId: string;
  status: SlotReservationStatus;
  expiresAt: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  skuCode: string;
  quantity: number;
  orderItemId?: string;
  createdAt: Date;
}

export interface ShipmentStatusHistory {
  id: string;
  shipmentId: string;
  fromStatus?: ShipmentStatus;
  toStatus: ShipmentStatus;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface TrackingEvent {
  id: string;
  shipmentId: string;
  providerStatus: string;
  normalizedStatus: ShipmentStatus;
  eventTime: Date;
  locationText?: string;
  note?: string;
  source: string;
  createdAt: Date;
}

export interface ProviderCallback {
  id: string;
  provider: ShippingProviderCode;
  payloadHash: string;
  signatureValid: boolean;
  rawPayloadJson: Record<string, unknown>;
  processed: boolean;
  resultStatus: CallbackStatus;
  shipmentId?: string;
  createdAt: Date;
}

export interface Shipment {
  id: string;
  orderId: string;
  orderCode: string;
  packageId: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  provider: ShippingProviderCode;
  status: ShipmentStatus;
  sourceLocationType: string;
  sourceLocationId: string;
  destinationJson?: Record<string, unknown>;
  shippingFee: number;
  currency: string;
  quoteId?: string;
  slotReservationId?: string;
  providerShipmentRef?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: Date;
  pickupCodeHash?: string;
  pickupCodeHint?: string;
  failureAttempts: number;
  orderSyncedAt?: Date;
  stockCommittedAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  items: ShipmentItem[];
  history: ShipmentStatusHistory[];
  tracking: TrackingEvent[];
}

export interface OutboxEventInput {
  eventType: string;
  routingKey: string;
  payload: Record<string, unknown>;
  traceId: string;
}

export interface OutboxEventRecord extends OutboxEventInput {
  id: string;
  publishedAt?: Date;
  createdAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  response: unknown;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateQuoteInput {
  id: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  totalFee: number;
  packageFees: PackageFee[];
  provider: ShippingProviderCode;
  expiresAt: Date;
  snapshotJson: Record<string, unknown>;
  outboxEvents: OutboxEventInput[];
  actorId: string;
}

export interface CreateSlotInput {
  id: string;
  deliveryDate: Date;
  windowStart: string;
  windowEnd: string;
  deliveryMethod: DeliveryMethod;
  locationType: string;
  locationId: string;
  capacity: number;
  cutoffAt: Date;
  timezone?: string;
}

export interface ReserveSlotInput {
  id: string;
  slotId: string;
  orderId?: string;
  customerId: string;
  expiresAt: Date;
  idempotencyKey: string;
  expectedSlotVersion: number;
  outboxEvents: OutboxEventInput[];
  actorId: string;
}

export interface CreateShipmentInput {
  id: string;
  orderId: string;
  orderCode: string;
  packageId: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  provider: ShippingProviderCode;
  status: ShipmentStatus;
  sourceLocationType: string;
  sourceLocationId: string;
  destinationJson?: Record<string, unknown>;
  shippingFee: number;
  currency: string;
  quoteId?: string;
  slotReservationId?: string;
  providerShipmentRef?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: Date;
  items: Array<{ skuCode: string; quantity: number; orderItemId?: string }>;
  outboxEvents: OutboxEventInput[];
  actorId: string;
  actorType: string;
}

export interface UpdateShipmentStatusInput {
  shipmentId: string;
  expectedVersion: number;
  status: ShipmentStatus;
  reason?: string;
  actorId: string;
  actorType: string;
  providerShipmentRef?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: Date;
  pickupCodeHash?: string;
  pickupCodeHint?: string;
  orderSyncedAt?: Date;
  stockCommittedAt?: Date;
  failureAttempts?: number;
  consumeSlotReservationId?: string;
  releaseSlotReservationId?: string;
  trackingEvent?: {
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
    eventTime: Date;
    locationText?: string;
    note?: string;
    source: string;
  };
  outboxEvents: OutboxEventInput[];
}

export interface CreateCallbackInput {
  provider: ShippingProviderCode;
  payloadHash: string;
  signatureValid: boolean;
  rawPayloadJson: Record<string, unknown>;
  processed: boolean;
  resultStatus: CallbackStatus;
  shipmentId?: string;
}

export interface ListShipmentsFilter {
  page: number;
  pageSize: number;
  status?: ShipmentStatus;
  provider?: ShippingProviderCode;
  orderId?: string;
  customerId?: string;
  packageId?: string;
  from?: Date;
  to?: Date;
  sort: string;
}

export interface ListShipmentsResult {
  items: Shipment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSlotsFilter {
  deliveryDate?: Date;
  deliveryMethod?: DeliveryMethod;
  locationType?: string;
  locationId?: string;
  onlyAvailable?: boolean;
}

export interface OrderPackageSnapshot {
  id: string;
  packageCode: string;
  status: string;
  sourceLocationType: 'warehouse' | 'store';
  sourceLocationId: string;
  items: Array<{
    id: string;
    orderItemId: string;
    skuCode: string;
    quantity: number;
  }>;
}

export interface OrderSnapshot {
  id: string;
  orderCode: string;
  customerId: string;
  status: string;
  deliveryMethod: DeliveryMethod;
  pickupStoreId?: string;
  reservationId?: string;
  shippingAddress?: Record<string, unknown>;
  packages: OrderPackageSnapshot[];
  shippingFee: number;
  currency: string;
  paymentMethod?: string;
}

export interface SyncShippingInput {
  packageId: string;
  shipmentId: string;
  trackingCode?: string;
  shippingProvider?: string;
  packageStatus?: string;
  estimatedDeliveryAt?: string;
  orderStatus?: string;
  idempotencyKey?: string;
}

export interface OrderClientHeaders {
  userId?: string;
  roles?: string[];
  traceId?: string;
}
