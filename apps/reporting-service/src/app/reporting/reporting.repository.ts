import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  AuditLogProjectionRecord,
  DailyMetricRecord,
  DashboardSummaryRaw,
  IdempotencyRecord,
  InsertAuditLogProjectionInput,
  ListAuditLogsFilter,
  ListDailyMetricsFilter,
  ListOrderProjectionFilter,
  ListPaymentProjectionFilter,
  ListProjectionFilter,
  ListResult,
  ListReviewProjectionFilter,
  ListShipmentProjectionFilter,
  ListSupportTicketProjectionFilter,
  ListWarrantyProjectionFilter,
  OrderProjectionRecord,
  PaymentProjectionRecord,
  ReviewProjectionRecord,
  ShipmentProjectionRecord,
  SupportTicketProjectionRecord,
  UpsertOrderProjectionInput,
  UpsertPaymentProjectionInput,
  UpsertReviewProjectionInput,
  UpsertShipmentProjectionInput,
  UpsertSupportTicketProjectionInput,
  UpsertWarrantyClaimProjectionInput,
  UpsertWarrantyReturnProjectionInput,
  WarrantyClaimProjectionRecord,
  WarrantyReturnProjectionRecord,
} from './reporting.types';

export const REPORTING_REPOSITORY = Symbol('REPORTING_REPOSITORY');

export interface ReportingRepository {
  upsertOrderProjection(input: UpsertOrderProjectionInput): Promise<void>;
  upsertPaymentProjection(input: UpsertPaymentProjectionInput): Promise<void>;
  upsertShipmentProjection(input: UpsertShipmentProjectionInput): Promise<void>;
  upsertReviewProjection(input: UpsertReviewProjectionInput): Promise<void>;
  upsertWarrantyClaimProjection(
    input: UpsertWarrantyClaimProjectionInput,
  ): Promise<void>;
  upsertWarrantyReturnProjection(
    input: UpsertWarrantyReturnProjectionInput,
  ): Promise<void>;
  upsertSupportTicketProjection(
    input: UpsertSupportTicketProjectionInput,
  ): Promise<void>;

  incrementDailyMetric(
    metricDate: Date,
    domain: string,
    metricKey: string,
    incrementBy: number,
  ): Promise<void>;

  insertAuditLogProjection(
    input: InsertAuditLogProjectionInput,
  ): Promise<AuditLogProjectionRecord>;

  listOrderProjections(
    filter: ListOrderProjectionFilter,
  ): Promise<ListResult<OrderProjectionRecord>>;
  listPaymentProjections(
    filter: ListPaymentProjectionFilter,
  ): Promise<ListResult<PaymentProjectionRecord>>;
  listShipmentProjections(
    filter: ListShipmentProjectionFilter,
  ): Promise<ListResult<ShipmentProjectionRecord>>;
  listReviewProjections(
    filter: ListReviewProjectionFilter,
  ): Promise<ListResult<ReviewProjectionRecord>>;
  listWarrantyClaimProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyClaimProjectionRecord>>;
  listWarrantyReturnProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyReturnProjectionRecord>>;
  listSupportTicketProjections(
    filter: ListSupportTicketProjectionFilter,
  ): Promise<ListResult<SupportTicketProjectionRecord>>;

  listAuditLogs(
    filter: ListAuditLogsFilter,
  ): Promise<ListResult<AuditLogProjectionRecord>>;
  listDailyMetrics(
    filter: ListDailyMetricsFilter,
  ): Promise<ListResult<DailyMetricRecord>>;

  getDashboardSummary(): Promise<DashboardSummaryRaw>;

  /** Inbox pattern: returns false if eventId already processed (unique PK). */
  tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean>;
  isProcessed(eventId: string): Promise<boolean>;

  getIdempotency(key: string): Promise<IdempotencyRecord | null>;
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
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function matchesRange(date: Date, from?: Date, to?: Date): boolean {
  if (from && date.getTime() < from.getTime()) {
    return false;
  }
  if (to && date.getTime() > to.getTime()) {
    return false;
  }
  return true;
}

function paginate<T>(items: T[], filter: ListProjectionFilter): T[] {
  const start = (filter.page - 1) * filter.pageSize;
  return items.slice(start, start + filter.pageSize);
}

function statusCounts<T extends { status: string }>(
  items: T[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

export class InMemoryReportingRepository implements ReportingRepository {
  private orders = new Map<string, OrderProjectionRecord>();
  private payments = new Map<string, PaymentProjectionRecord>();
  private shipments = new Map<string, ShipmentProjectionRecord>();
  private reviews = new Map<string, ReviewProjectionRecord>();
  private warrantyClaims = new Map<string, WarrantyClaimProjectionRecord>();
  private warrantyReturns = new Map<string, WarrantyReturnProjectionRecord>();
  private supportTickets = new Map<string, SupportTicketProjectionRecord>();
  private dailyMetrics = new Map<string, DailyMetricRecord>();
  private auditLogProjections = new Map<string, AuditLogProjectionRecord>();
  private auditLogBySourceEventId = new Map<string, string>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private processed = new Map<string, ProcessedEntry>();
  private audits: Array<{
    id: string;
    action: string;
    actorId: string;
    details?: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  clear(): void {
    this.orders.clear();
    this.payments.clear();
    this.shipments.clear();
    this.reviews.clear();
    this.warrantyClaims.clear();
    this.warrantyReturns.clear();
    this.supportTickets.clear();
    this.dailyMetrics.clear();
    this.auditLogProjections.clear();
    this.auditLogBySourceEventId.clear();
    this.idempotency.clear();
    this.processed.clear();
    this.audits = [];
  }

  async upsertOrderProjection(
    input: UpsertOrderProjectionInput,
  ): Promise<void> {
    const existing = this.orders.get(input.orderId);
    if (!existing) {
      this.orders.set(input.orderId, {
        orderId: input.orderId,
        orderCode: input.orderCode,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        grandTotal: input.grandTotal ?? 0,
        totalQuantity: input.totalQuantity ?? 0,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
        lastEventId: input.lastEventId,
      });
      return;
    }
    existing.orderCode = input.orderCode ?? existing.orderCode;
    existing.customerId = input.customerId ?? existing.customerId;
    existing.status = input.status ?? existing.status;
    existing.grandTotal = input.grandTotal ?? existing.grandTotal;
    existing.totalQuantity = input.totalQuantity ?? existing.totalQuantity;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
    existing.lastEventId = input.lastEventId;
  }

  async upsertPaymentProjection(
    input: UpsertPaymentProjectionInput,
  ): Promise<void> {
    const existing = this.payments.get(input.paymentId);
    if (!existing) {
      this.payments.set(input.paymentId, {
        paymentId: input.paymentId,
        orderId: input.orderId,
        status: input.status ?? 'UNKNOWN',
        amount: input.amount ?? 0,
        method: input.method,
        currency: input.currency ?? 'VND',
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.orderId = input.orderId ?? existing.orderId;
    existing.status = input.status ?? existing.status;
    existing.amount = input.amount ?? existing.amount;
    existing.method = input.method ?? existing.method;
    existing.currency = input.currency ?? existing.currency;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async upsertShipmentProjection(
    input: UpsertShipmentProjectionInput,
  ): Promise<void> {
    const existing = this.shipments.get(input.shipmentId);
    if (!existing) {
      this.shipments.set(input.shipmentId, {
        shipmentId: input.shipmentId,
        orderId: input.orderId,
        status: input.status ?? 'UNKNOWN',
        carrierCode: input.carrierCode,
        trackingCode: input.trackingCode,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.orderId = input.orderId ?? existing.orderId;
    existing.status = input.status ?? existing.status;
    existing.carrierCode = input.carrierCode ?? existing.carrierCode;
    existing.trackingCode = input.trackingCode ?? existing.trackingCode;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async upsertReviewProjection(
    input: UpsertReviewProjectionInput,
  ): Promise<void> {
    const existing = this.reviews.get(input.reviewId);
    if (!existing) {
      this.reviews.set(input.reviewId, {
        reviewId: input.reviewId,
        productId: input.productId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        rating: input.rating,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        deletedAt: input.deletedAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.productId = input.productId ?? existing.productId;
    existing.customerId = input.customerId ?? existing.customerId;
    existing.status = input.status ?? existing.status;
    existing.rating = input.rating ?? existing.rating;
    existing.deletedAt = input.deletedAt ?? existing.deletedAt;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async upsertWarrantyClaimProjection(
    input: UpsertWarrantyClaimProjectionInput,
  ): Promise<void> {
    const existing = this.warrantyClaims.get(input.claimId);
    if (!existing) {
      this.warrantyClaims.set(input.claimId, {
        claimId: input.claimId,
        orderId: input.orderId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.orderId = input.orderId ?? existing.orderId;
    existing.customerId = input.customerId ?? existing.customerId;
    existing.status = input.status ?? existing.status;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async upsertWarrantyReturnProjection(
    input: UpsertWarrantyReturnProjectionInput,
  ): Promise<void> {
    const existing = this.warrantyReturns.get(input.returnId);
    if (!existing) {
      this.warrantyReturns.set(input.returnId, {
        returnId: input.returnId,
        orderId: input.orderId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.orderId = input.orderId ?? existing.orderId;
    existing.customerId = input.customerId ?? existing.customerId;
    existing.status = input.status ?? existing.status;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async upsertSupportTicketProjection(
    input: UpsertSupportTicketProjectionInput,
  ): Promise<void> {
    const existing = this.supportTickets.get(input.ticketId);
    if (!existing) {
      this.supportTickets.set(input.ticketId, {
        ticketId: input.ticketId,
        ticketCode: input.ticketCode,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        priority: input.priority,
        category: input.category,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
        lastEventType: input.lastEventType,
      });
      return;
    }
    existing.ticketCode = input.ticketCode ?? existing.ticketCode;
    existing.customerId = input.customerId ?? existing.customerId;
    existing.status = input.status ?? existing.status;
    existing.priority = input.priority ?? existing.priority;
    existing.category = input.category ?? existing.category;
    existing.updatedAt = new Date();
    existing.lastEventType = input.lastEventType;
  }

  async incrementDailyMetric(
    metricDate: Date,
    domain: string,
    metricKey: string,
    incrementBy: number,
  ): Promise<void> {
    const key = `${dateKey(metricDate)}|${domain}|${metricKey}`;
    const existing = this.dailyMetrics.get(key);
    if (existing) {
      existing.value += BigInt(incrementBy);
      return;
    }
    this.dailyMetrics.set(key, {
      id: createId(),
      metricDate,
      domain,
      metricKey,
      value: BigInt(incrementBy),
    });
  }

  async insertAuditLogProjection(
    input: InsertAuditLogProjectionInput,
  ): Promise<AuditLogProjectionRecord> {
    if (input.sourceEventId) {
      const existingId = this.auditLogBySourceEventId.get(input.sourceEventId);
      if (existingId) {
        const existing = this.auditLogProjections.get(existingId);
        if (existing) {
          return { ...existing };
        }
      }
    }
    const record: AuditLogProjectionRecord = {
      id: createId(),
      sourceEventId: input.sourceEventId,
      action: input.action,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      serviceName: input.serviceName,
      details: input.details,
      occurredAt: input.occurredAt,
      createdAt: new Date(),
    };
    this.auditLogProjections.set(record.id, record);
    if (input.sourceEventId) {
      this.auditLogBySourceEventId.set(input.sourceEventId, record.id);
    }
    return { ...record };
  }

  async listOrderProjections(
    filter: ListOrderProjectionFilter,
  ): Promise<ListResult<OrderProjectionRecord>> {
    let items = [...this.orders.values()];
    if (filter.status) {
      items = items.filter((o) => o.status === filter.status);
    }
    if (filter.customerId) {
      items = items.filter((o) => o.customerId === filter.customerId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listPaymentProjections(
    filter: ListPaymentProjectionFilter,
  ): Promise<ListResult<PaymentProjectionRecord>> {
    let items = [...this.payments.values()];
    if (filter.status) {
      items = items.filter((p) => p.status === filter.status);
    }
    if (filter.orderId) {
      items = items.filter((p) => p.orderId === filter.orderId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listShipmentProjections(
    filter: ListShipmentProjectionFilter,
  ): Promise<ListResult<ShipmentProjectionRecord>> {
    let items = [...this.shipments.values()];
    if (filter.status) {
      items = items.filter((s) => s.status === filter.status);
    }
    if (filter.orderId) {
      items = items.filter((s) => s.orderId === filter.orderId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listReviewProjections(
    filter: ListReviewProjectionFilter,
  ): Promise<ListResult<ReviewProjectionRecord>> {
    let items = [...this.reviews.values()];
    if (filter.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter.productId) {
      items = items.filter((r) => r.productId === filter.productId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listWarrantyClaimProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyClaimProjectionRecord>> {
    let items = [...this.warrantyClaims.values()];
    if (filter.status) {
      items = items.filter((c) => c.status === filter.status);
    }
    if (filter.customerId) {
      items = items.filter((c) => c.customerId === filter.customerId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listWarrantyReturnProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyReturnProjectionRecord>> {
    let items = [...this.warrantyReturns.values()];
    if (filter.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter.customerId) {
      items = items.filter((r) => r.customerId === filter.customerId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listSupportTicketProjections(
    filter: ListSupportTicketProjectionFilter,
  ): Promise<ListResult<SupportTicketProjectionRecord>> {
    let items = [...this.supportTickets.values()];
    if (filter.status) {
      items = items.filter((t) => t.status === filter.status);
    }
    if (filter.customerId) {
      items = items.filter((t) => t.customerId === filter.customerId);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listAuditLogs(
    filter: ListAuditLogsFilter,
  ): Promise<ListResult<AuditLogProjectionRecord>> {
    let items = [...this.auditLogProjections.values()];
    if (filter.action) {
      items = items.filter((a) => a.action === filter.action);
    }
    if (filter.actorId) {
      items = items.filter((a) => a.actorId === filter.actorId);
    }
    if (filter.resourceType) {
      items = items.filter((a) => a.resourceType === filter.resourceType);
    }
    if (filter.resourceId) {
      items = items.filter((a) => a.resourceId === filter.resourceId);
    }
    if (filter.dateFrom || filter.dateTo) {
      items = items.filter((a) =>
        matchesRange(a.occurredAt, filter.dateFrom, filter.dateTo),
      );
    }
    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async listDailyMetrics(
    filter: ListDailyMetricsFilter,
  ): Promise<ListResult<DailyMetricRecord>> {
    let items = [...this.dailyMetrics.values()];
    if (filter.domain) {
      items = items.filter((m) => m.domain === filter.domain);
    }
    if (filter.dateFrom || filter.dateTo) {
      items = items.filter((m) =>
        matchesRange(m.metricDate, filter.dateFrom, filter.dateTo),
      );
    }
    items.sort((a, b) => b.metricDate.getTime() - a.metricDate.getTime());
    return { items: paginate(items, filter), totalItems: items.length };
  }

  async getDashboardSummary(): Promise<DashboardSummaryRaw> {
    const orders = [...this.orders.values()];
    const payments = [...this.payments.values()];
    const shipments = [...this.shipments.values()];
    const reviews = [...this.reviews.values()];
    const claims = [...this.warrantyClaims.values()];
    const returns = [...this.warrantyReturns.values()];
    const tickets = [...this.supportTickets.values()];
    let totalRevenue = BigInt(0);
    for (const metric of this.dailyMetrics.values()) {
      if (metric.domain === 'PAYMENT' && metric.metricKey === 'revenue_vnd') {
        totalRevenue += metric.value;
      }
    }
    return {
      totalOrders: orders.length,
      ordersByStatus: statusCounts(orders),
      totalRevenue,
      totalPayments: payments.length,
      paymentsByStatus: statusCounts(payments),
      totalShipments: shipments.length,
      shipmentsByStatus: statusCounts(shipments),
      totalReviews: reviews.length,
      reviewsByStatus: statusCounts(reviews),
      totalWarrantyClaims: claims.length,
      warrantyClaimsByStatus: statusCounts(claims),
      totalWarrantyReturns: returns.length,
      warrantyReturnsByStatus: statusCounts(returns),
      totalSupportTickets: tickets.length,
      supportTicketsByStatus: statusCounts(tickets),
    };
  }

  async tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean> {
    if (this.processed.has(eventId)) {
      return false;
    }
    this.processed.set(eventId, {
      eventId,
      eventType,
      routingKey,
      processedAt: new Date(),
      result,
    });
    return true;
  }

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const record = this.idempotency.get(key);
    return record ? { ...record } : null;
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    if (this.idempotency.has(key)) {
      throw new AppError({
        errorCode: ErrorCodes.REPORTING_IDEMPOTENCY_CONFLICT,
        message: 'Idempotency key đã được sử dụng',
      });
    }
    this.idempotency.set(key, {
      key,
      operation,
      response,
      createdAt: new Date(),
    });
  }

  async writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    this.audits.push({
      id: createId(),
      action,
      actorId,
      details,
      createdAt: new Date(),
    });
  }
}

interface ProcessedEntry {
  eventId: string;
  eventType: string;
  routingKey?: string;
  processedAt: Date;
  result?: unknown;
}
