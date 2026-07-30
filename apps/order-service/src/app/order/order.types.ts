import type {
  DeliveryMethod,
  LocationType,
  OrderStatus,
  PackageStatus,
  PaymentMethod,
  PaymentStatus,
} from '@nexatech/shared-contracts';

export type {
  DeliveryMethod,
  LocationType,
  OrderStatus,
  PackageStatus,
  PaymentMethod,
  PaymentStatus,
};

export type RefundContractStatus = 'NOT_REQUIRED' | 'PENDING' | 'COMPLETED';

export interface OrderItem {
  id: string;
  orderId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  variantAttributes: Record<string, string>;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  currency: string;
}

export interface OrderAddressSnapshot {
  id: string;
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: string;
  fullText: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  actorId: string;
  actorType: string;
  reason?: string;
  createdAt: Date;
}

export interface OrderPackageItem {
  id: string;
  packageId: string;
  orderItemId: string;
  skuCode: string;
  quantity: number;
}

export interface OrderPackage {
  id: string;
  orderId: string;
  packageCode: string;
  status: PackageStatus;
  sourceLocationType: LocationType;
  sourceLocationId: string;
  shippingProvider?: string;
  trackingCode?: string;
  estimatedDeliveryAt?: Date;
  items: OrderPackageItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customerDisplayName?: string;
  customerEmail?: string;
  customerPhone?: string;
  status: OrderStatus;
  version: number;
  cartId: string;
  reservationId?: string;
  deliveryMethod: DeliveryMethod;
  deliverySlot?: string;
  pickupStoreId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paidAt?: Date;
  currency: string;
  merchandiseSubtotal: number;
  shippingFee: number;
  discountTotal: number;
  grandTotal: number;
  totalQuantity: number;
  cancelReason?: string;
  cancelledAt?: Date;
  inventoryReleased: boolean;
  refundContractStatus?: RefundContractStatus;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
  address?: OrderAddressSnapshot;
  packages: OrderPackage[];
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  responseJson: unknown;
  createdAt: Date;
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  routingKey: string;
  payload: unknown;
  traceId: string;
  publishedAt?: Date;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

/** ---- Repository input shapes ---- */

export interface OutboxEventInput {
  eventType: string;
  routingKey: string;
  payload: Record<string, unknown>;
  traceId: string;
}

export interface CreateOrderItemInput {
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  variantAttributes: Record<string, string>;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  currency: string;
}

export interface CreateOrderAddressInput {
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: string;
  fullText: string;
}

export interface CreateOrderPackageItemInput {
  skuCode: string;
  quantity: number;
}

export interface CreateOrderPackageInput {
  packageCode: string;
  status: PackageStatus;
  sourceLocationType: LocationType;
  sourceLocationId: string;
  items: CreateOrderPackageItemInput[];
}

export interface CreateOrderWithRelationsInput {
  id: string;
  orderCode: string;
  customerId: string;
  customerDisplayName?: string;
  customerEmail?: string;
  customerPhone?: string;
  status: OrderStatus;
  cartId: string;
  reservationId?: string;
  deliveryMethod: DeliveryMethod;
  deliverySlot?: string;
  pickupStoreId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  currency: string;
  merchandiseSubtotal: number;
  shippingFee: number;
  discountTotal: number;
  grandTotal: number;
  totalQuantity: number;
  items: CreateOrderItemInput[];
  address?: CreateOrderAddressInput;
  packages: CreateOrderPackageInput[];
  actorId: string;
  actorType: string;
  outboxEvents: OutboxEventInput[];
}

export interface UpdateOrderStatusInput {
  orderId: string;
  expectedVersion: number;
  toStatus: OrderStatus;
  actorId: string;
  actorType: string;
  reason?: string;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  paidAt?: Date | null;
  cancelReason?: string;
  cancelledAt?: Date;
  inventoryReleased?: boolean;
  refundContractStatus?: RefundContractStatus;
  outboxEvents?: OutboxEventInput[];
}

export interface UpdateOrderPaymentInput {
  orderId: string;
  expectedVersion: number;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paidAt?: Date | null;
  refundContractStatus?: RefundContractStatus;
  /** Khi set, chuyển trạng thái đơn (ví dụ AWAITING_PAYMENT → CONFIRMED) */
  toStatus?: OrderStatus;
  actorId: string;
  actorType: string;
  reason?: string;
  outboxEvents?: OutboxEventInput[];
}

export interface ListOrdersFilter {
  customerId?: string;
  status?: OrderStatus;
  orderCode?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
  sort:
    | 'createdAt_desc'
    | 'createdAt_asc'
    | 'grandTotal_desc'
    | 'grandTotal_asc';
}

export interface ListOrdersResult {
  items: Order[];
  total: number;
}

/** ---- External service contract shapes ---- */

export interface CatalogSkuInfo {
  skuId: string;
  skuCode: string;
  productId: string;
  productName: string;
  productStatus: 'draft' | 'active' | 'inactive' | 'archived';
  skuName: string;
  attributes: Record<string, string>;
  unitPrice: number;
  currency: string;
  isSellable: boolean;
}

export interface CartSnapshotItem {
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

export interface CartSnapshot {
  id: string;
  version: number;
  items: CartSnapshotItem[];
}

export interface CartValidationIssue {
  skuCode: string;
  code: string;
  message: string;
}

export interface CartValidationResult {
  valid: boolean;
  issues: CartValidationIssue[];
}

export interface ConvertCartInput {
  orderId?: string;
  idempotencyKey?: string;
}

export interface ReserveStockLine {
  skuCode: string;
  quantity: number;
}

export interface ReservationLineResult {
  skuCode: string;
  quantity: number;
  locationType: LocationType;
  locationId: string;
}

export interface ReservationResult {
  id: string;
  orderId?: string;
  lines: ReservationLineResult[];
}

export interface ReserveStockInput {
  idempotencyKey: string;
  orderId: string;
  lines: ReserveStockLine[];
}
