export interface Actor {
  userId: string;
  roles: string[];
}

/** ---------- Projection records (read model) ---------- */

export interface OrderProjectionRecord {
  orderId: string;
  orderCode?: string;
  customerId?: string;
  status: string;
  grandTotal: number;
  totalQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
  lastEventId?: string;
}

export interface UpsertOrderProjectionInput {
  orderId: string;
  orderCode?: string;
  customerId?: string;
  status?: string;
  grandTotal?: number;
  totalQuantity?: number;
  occurredAt: Date;
  lastEventType: string;
  lastEventId: string;
}

export interface PaymentProjectionRecord {
  paymentId: string;
  orderId?: string;
  status: string;
  amount: number;
  method?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
}

export interface UpsertPaymentProjectionInput {
  paymentId: string;
  orderId?: string;
  status?: string;
  amount?: number;
  method?: string;
  currency?: string;
  occurredAt: Date;
  lastEventType: string;
}

export interface ShipmentProjectionRecord {
  shipmentId: string;
  orderId?: string;
  status: string;
  carrierCode?: string;
  trackingCode?: string;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
}

export interface UpsertShipmentProjectionInput {
  shipmentId: string;
  orderId?: string;
  status?: string;
  carrierCode?: string;
  trackingCode?: string;
  occurredAt: Date;
  lastEventType: string;
}

export interface ReviewProjectionRecord {
  reviewId: string;
  productId?: string;
  customerId?: string;
  status: string;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  lastEventType?: string;
}

export interface UpsertReviewProjectionInput {
  reviewId: string;
  productId?: string;
  customerId?: string;
  status?: string;
  rating?: number;
  deletedAt?: Date;
  occurredAt: Date;
  lastEventType: string;
}

export interface WarrantyClaimProjectionRecord {
  claimId: string;
  orderId?: string;
  customerId?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
}

export interface UpsertWarrantyClaimProjectionInput {
  claimId: string;
  orderId?: string;
  customerId?: string;
  status?: string;
  occurredAt: Date;
  lastEventType: string;
}

export interface WarrantyReturnProjectionRecord {
  returnId: string;
  orderId?: string;
  customerId?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
}

export interface UpsertWarrantyReturnProjectionInput {
  returnId: string;
  orderId?: string;
  customerId?: string;
  status?: string;
  occurredAt: Date;
  lastEventType: string;
}

export interface SupportTicketProjectionRecord {
  ticketId: string;
  ticketCode?: string;
  customerId?: string;
  status: string;
  priority?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  lastEventType?: string;
}

export interface UpsertSupportTicketProjectionInput {
  ticketId: string;
  ticketCode?: string;
  customerId?: string;
  status?: string;
  priority?: string;
  category?: string;
  occurredAt: Date;
  lastEventType: string;
}

/** ---------- Daily metrics ---------- */

export interface DailyMetricRecord {
  id: string;
  metricDate: Date;
  domain: string;
  metricKey: string;
  value: bigint;
}

export interface ListDailyMetricsFilter {
  dateFrom?: Date;
  dateTo?: Date;
  domain?: string;
  page: number;
  pageSize: number;
}

/** ---------- Audit log projection ---------- */

export interface AuditLogProjectionRecord {
  id: string;
  sourceEventId?: string;
  action: string;
  actorId?: string;
  actorRoles?: string[];
  resourceType?: string;
  resourceId?: string;
  serviceName?: string;
  details?: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
}

export interface InsertAuditLogProjectionInput {
  sourceEventId?: string;
  action: string;
  actorId?: string;
  actorRoles?: string[];
  resourceType?: string;
  resourceId?: string;
  serviceName?: string;
  details?: Record<string, unknown>;
  occurredAt: Date;
}

export interface ListAuditLogsFilter {
  action?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

/** ---------- Common pagination ---------- */

export interface PageFilter {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  items: T[];
  totalItems: number;
}

export interface ListProjectionFilter extends PageFilter {
  status?: string;
}

export interface ListOrderProjectionFilter extends ListProjectionFilter {
  customerId?: string;
}

export interface ListPaymentProjectionFilter extends ListProjectionFilter {
  orderId?: string;
}

export interface ListShipmentProjectionFilter extends ListProjectionFilter {
  orderId?: string;
}

export interface ListReviewProjectionFilter extends ListProjectionFilter {
  productId?: string;
}

export interface ListWarrantyProjectionFilter extends ListProjectionFilter {
  customerId?: string;
}

export interface ListSupportTicketProjectionFilter
  extends ListProjectionFilter {
  customerId?: string;
}

/** ---------- Dashboard summary ---------- */

export interface DashboardSummaryRaw {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenue: bigint;
  totalPayments: number;
  paymentsByStatus: Record<string, number>;
  totalShipments: number;
  shipmentsByStatus: Record<string, number>;
  totalReviews: number;
  reviewsByStatus: Record<string, number>;
  totalWarrantyClaims: number;
  warrantyClaimsByStatus: Record<string, number>;
  totalWarrantyReturns: number;
  warrantyReturnsByStatus: Record<string, number>;
  totalSupportTickets: number;
  supportTicketsByStatus: Record<string, number>;
}

/** ---------- Inbox pattern (event idempotency) ---------- */

export interface ProcessedEventRecord {
  eventId: string;
  eventType: string;
  routingKey?: string;
  processedAt: Date;
  result?: unknown;
}

/** ---------- Idempotency (REST) ---------- */

export interface IdempotencyRecord {
  key: string;
  operation: string;
  response: unknown;
  createdAt: Date;
}

/** ---------- Local audit ---------- */

export interface AuditInput {
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
}
