import {
  createPaginatedResponse,
  dailyMetricsQuerySchema,
  listAuditLogsQuerySchema,
  listOrderProjectionsQuerySchema,
  listPaymentProjectionsQuerySchema,
  listReviewProjectionsQuerySchema,
  listShipmentProjectionsQuerySchema,
  listSupportTicketProjectionsQuerySchema,
  listWarrantyClaimProjectionsQuerySchema,
  listWarrantyReturnProjectionsQuerySchema,
  recordAuditRequestSchema,
  type AuditLogProjectionDto,
  type DailyMetricDto,
  type DashboardSummaryDto,
  type OrderProjectionDto,
  type PaymentProjectionDto,
  type RecordAuditResultDto,
  type ReviewProjectionDto,
  type ShipmentProjectionDto,
  type SupportTicketProjectionDto,
  type WarrantyClaimProjectionDto,
  type WarrantyReturnProjectionDto,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { EventEnvelope, EventType } from '@nexatech/shared-events';
import { routingKeyFor } from '@nexatech/shared-events';
import {
  domainForEventType,
  extractAuditData,
  extractOrderData,
  extractPaymentData,
  extractReviewData,
  extractRevenueAmount,
  extractShipmentData,
  extractSupportTicketData,
  extractWarrantyClaimData,
  extractWarrantyReturnData,
  isRevenueEvent,
  metricKeyForEvent,
} from './event-handlers';
import type { ReportingRepository } from './reporting.repository';
import type {
  Actor,
  AuditLogProjectionRecord,
  DailyMetricRecord,
  OrderProjectionRecord,
  PaymentProjectionRecord,
  ReviewProjectionRecord,
  ShipmentProjectionRecord,
  SupportTicketProjectionRecord,
  WarrantyClaimProjectionRecord,
  WarrantyReturnProjectionRecord,
} from './reporting.types';

const STAFF_ROLES = new Set(['Staff', 'Manager', 'Admin', 'SuperAdmin']);

export function parseActor(userId?: string, rolesHeader?: string): Actor {
  const roles = (rolesHeader ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return { userId: (userId ?? '').trim(), roles };
}

export function isStaff(actor: Actor): boolean {
  return actor.roles.some((r) => STAFF_ROLES.has(r));
}

function requireStaff(actor: Actor): void {
  if (!actor.userId) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Yêu cầu đăng nhập',
    });
  }
  if (!isStaff(actor)) {
    throw new AppError({
      errorCode: ErrorCodes.REPORTING_FORBIDDEN,
      message: 'Không đủ quyền',
    });
  }
}

function truncateToDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toOrderDto(record: OrderProjectionRecord): OrderProjectionDto {
  return {
    orderId: record.orderId,
    orderCode: record.orderCode,
    customerId: record.customerId,
    status: record.status,
    grandTotal: record.grandTotal,
    totalQuantity: record.totalQuantity,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
    lastEventId: record.lastEventId,
  };
}

function toPaymentDto(record: PaymentProjectionRecord): PaymentProjectionDto {
  return {
    paymentId: record.paymentId,
    orderId: record.orderId,
    status: record.status,
    amount: record.amount,
    method: record.method,
    currency: record.currency,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toShipmentDto(
  record: ShipmentProjectionRecord,
): ShipmentProjectionDto {
  return {
    shipmentId: record.shipmentId,
    orderId: record.orderId,
    status: record.status,
    carrierCode: record.carrierCode,
    trackingCode: record.trackingCode,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toReviewDto(record: ReviewProjectionRecord): ReviewProjectionDto {
  return {
    reviewId: record.reviewId,
    productId: record.productId,
    customerId: record.customerId,
    status: record.status,
    rating: record.rating,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toClaimDto(
  record: WarrantyClaimProjectionRecord,
): WarrantyClaimProjectionDto {
  return {
    claimId: record.claimId,
    orderId: record.orderId,
    customerId: record.customerId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toReturnDto(
  record: WarrantyReturnProjectionRecord,
): WarrantyReturnProjectionDto {
  return {
    returnId: record.returnId,
    orderId: record.orderId,
    customerId: record.customerId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toTicketDto(
  record: SupportTicketProjectionRecord,
): SupportTicketProjectionDto {
  return {
    ticketId: record.ticketId,
    ticketCode: record.ticketCode,
    customerId: record.customerId,
    status: record.status,
    priority: record.priority,
    category: record.category,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastEventType: record.lastEventType,
  };
}

function toDailyMetricDto(record: DailyMetricRecord): DailyMetricDto {
  return {
    id: record.id,
    metricDate: record.metricDate.toISOString().slice(0, 10),
    domain: record.domain,
    metricKey: record.metricKey,
    value: Number(record.value),
  };
}

function toAuditLogDto(
  record: AuditLogProjectionRecord,
): AuditLogProjectionDto {
  return {
    id: record.id,
    sourceEventId: record.sourceEventId,
    action: record.action,
    actorId: record.actorId,
    actorRoles: record.actorRoles,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    serviceName: record.serviceName,
    details: record.details,
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export interface ProcessEventResult {
  processed: boolean;
  handled: boolean;
}

export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  private async withIdempotency<T>(
    key: string | undefined,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return fn();
    }
    const existing = await this.repository.getIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.REPORTING_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã dùng cho thao tác khác',
        });
      }
      return existing.response as T;
    }
    const result = await fn();
    await this.repository.saveIdempotency(key, operation, result);
    return result;
  }

  /** ===================== Event consumption (inbox pattern) ===================== */

  async processEventEnvelope(
    envelope: EventEnvelope,
  ): Promise<ProcessEventResult> {
    if (await this.repository.isProcessed(envelope.eventId)) {
      return { processed: false, handled: false };
    }

    const domain = domainForEventType(envelope.eventType);
    const occurredAt = new Date(envelope.occurredAt);
    const metricDate = truncateToDate(occurredAt);
    let handled = false;

    switch (domain) {
      case 'ORDER': {
        const data = extractOrderData(envelope);
        if (data) {
          await this.repository.upsertOrderProjection({
            ...data,
            occurredAt,
            lastEventType: envelope.eventType,
            lastEventId: envelope.eventId,
          });
          handled = true;
        }
        break;
      }
      case 'PAYMENT': {
        const data = extractPaymentData(envelope);
        if (data) {
          await this.repository.upsertPaymentProjection({
            ...data,
            occurredAt,
            lastEventType: envelope.eventType,
          });
          handled = true;
          if (isRevenueEvent(envelope.eventType)) {
            const amount = extractRevenueAmount(
              (envelope.payload ?? {}) as Record<string, unknown>,
            );
            if (amount > 0) {
              await this.repository.incrementDailyMetric(
                metricDate,
                'PAYMENT',
                'revenue_vnd',
                amount,
              );
            }
          }
        }
        break;
      }
      case 'SHIPPING': {
        const data = extractShipmentData(envelope);
        if (data) {
          await this.repository.upsertShipmentProjection({
            ...data,
            occurredAt,
            lastEventType: envelope.eventType,
          });
          handled = true;
        }
        break;
      }
      case 'REVIEW': {
        const data = extractReviewData(envelope);
        if (data) {
          await this.repository.upsertReviewProjection({
            ...data,
            occurredAt,
            lastEventType: envelope.eventType,
          });
          handled = true;
        }
        break;
      }
      case 'WARRANTY': {
        if (envelope.eventType.startsWith('warranty.claim')) {
          const data = extractWarrantyClaimData(envelope);
          if (data) {
            await this.repository.upsertWarrantyClaimProjection({
              ...data,
              occurredAt,
              lastEventType: envelope.eventType,
            });
            handled = true;
          }
        } else if (envelope.eventType.startsWith('warranty.return')) {
          const data = extractWarrantyReturnData(envelope);
          if (data) {
            await this.repository.upsertWarrantyReturnProjection({
              ...data,
              occurredAt,
              lastEventType: envelope.eventType,
            });
            handled = true;
          }
        }
        break;
      }
      case 'SUPPORT': {
        const data = extractSupportTicketData(envelope);
        if (data) {
          await this.repository.upsertSupportTicketProjection({
            ...data,
            occurredAt,
            lastEventType: envelope.eventType,
          });
          handled = true;
        }
        break;
      }
      case 'AUDIT': {
        const data = extractAuditData(envelope);
        await this.repository.insertAuditLogProjection({
          sourceEventId: envelope.eventId,
          action: data.action,
          actorId: data.actorId,
          actorRoles: data.actorRoles,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          serviceName: data.serviceName,
          details: data.details,
          occurredAt,
        });
        handled = true;
        break;
      }
      default:
        break;
    }

    if (handled) {
      const metricKey = metricKeyForEvent(envelope.eventType, domain);
      await this.repository.incrementDailyMetric(
        metricDate,
        domain,
        metricKey,
        1,
      );
    }

    let routingKey: string | undefined;
    try {
      routingKey = routingKeyFor(envelope.eventType as EventType);
    } catch {
      routingKey = undefined;
    }

    const wasNew = await this.repository.tryMarkProcessed(
      envelope.eventId,
      envelope.eventType,
      routingKey,
      { handled },
    );

    if (wasNew) {
      await this.repository.writeAudit('reporting.event.processed', 'system', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        handled,
      });
    }

    return { processed: wasNew, handled };
  }

  /** ===================== Dashboard ===================== */

  async getDashboard(actor: Actor): Promise<DashboardSummaryDto> {
    requireStaff(actor);
    const raw = await this.repository.getDashboardSummary();
    return {
      totalOrders: raw.totalOrders,
      ordersByStatus: raw.ordersByStatus,
      totalRevenue: Number(raw.totalRevenue),
      totalPayments: raw.totalPayments,
      paymentsByStatus: raw.paymentsByStatus,
      totalShipments: raw.totalShipments,
      shipmentsByStatus: raw.shipmentsByStatus,
      totalReviews: raw.totalReviews,
      reviewsByStatus: raw.reviewsByStatus,
      totalWarrantyClaims: raw.totalWarrantyClaims,
      warrantyClaimsByStatus: raw.warrantyClaimsByStatus,
      totalWarrantyReturns: raw.totalWarrantyReturns,
      warrantyReturnsByStatus: raw.warrantyReturnsByStatus,
      totalSupportTickets: raw.totalSupportTickets,
      supportTicketsByStatus: raw.supportTicketsByStatus,
      generatedAt: new Date().toISOString(),
    };
  }

  async listDailyMetrics(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = dailyMetricsQuerySchema.parse(query);
    const result = await this.repository.listDailyMetrics({
      dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : undefined,
      dateTo: parsed.dateTo ? new Date(parsed.dateTo) : undefined,
      domain: parsed.domain,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map(toDailyMetricDto),
      result.totalItems,
      parsed,
    );
  }

  /** ===================== Projection listing ===================== */

  async listOrders(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listOrderProjectionsQuerySchema.parse(query);
    const result = await this.repository.listOrderProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toOrderDto),
      result.totalItems,
      parsed,
    );
  }

  async listPayments(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listPaymentProjectionsQuerySchema.parse(query);
    const result = await this.repository.listPaymentProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toPaymentDto),
      result.totalItems,
      parsed,
    );
  }

  async listShipments(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listShipmentProjectionsQuerySchema.parse(query);
    const result = await this.repository.listShipmentProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toShipmentDto),
      result.totalItems,
      parsed,
    );
  }

  async listReviews(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listReviewProjectionsQuerySchema.parse(query);
    const result = await this.repository.listReviewProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toReviewDto),
      result.totalItems,
      parsed,
    );
  }

  async listWarrantyClaims(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listWarrantyClaimProjectionsQuerySchema.parse(query);
    const result = await this.repository.listWarrantyClaimProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toClaimDto),
      result.totalItems,
      parsed,
    );
  }

  async listWarrantyReturns(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listWarrantyReturnProjectionsQuerySchema.parse(query);
    const result = await this.repository.listWarrantyReturnProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toReturnDto),
      result.totalItems,
      parsed,
    );
  }

  async listSupportTickets(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listSupportTicketProjectionsQuerySchema.parse(query);
    const result = await this.repository.listSupportTicketProjections(parsed);
    return createPaginatedResponse(
      result.items.map(toTicketDto),
      result.totalItems,
      parsed,
    );
  }

  async listAuditLogs(actor: Actor, query: Record<string, unknown>) {
    requireStaff(actor);
    const parsed = listAuditLogsQuerySchema.parse(query);
    const result = await this.repository.listAuditLogs({
      action: parsed.action,
      actorId: parsed.actorId,
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId,
      dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : undefined,
      dateTo: parsed.dateTo ? new Date(parsed.dateTo) : undefined,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return createPaginatedResponse(
      result.items.map(toAuditLogDto),
      result.totalItems,
      parsed,
    );
  }

  /** ===================== REST — staff-triggered audit recording ===================== */

  async recordAudit(
    actor: Actor,
    body: unknown,
    headerIdempotencyKey?: string,
  ): Promise<RecordAuditResultDto> {
    requireStaff(actor);
    const rawBody = (body ?? {}) as Record<string, unknown>;
    const merged =
      headerIdempotencyKey && rawBody['idempotencyKey'] === undefined
        ? { ...rawBody, idempotencyKey: headerIdempotencyKey }
        : rawBody;
    const input = recordAuditRequestSchema.parse(merged);

    return this.withIdempotency(
      input.idempotencyKey,
      'recordAudit',
      async () => {
        const occurredAt = new Date();
        const record = await this.repository.insertAuditLogProjection({
          action: input.action,
          actorId: input.actorId ?? actor.userId,
          actorRoles: input.actorRoles ?? actor.roles,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          serviceName: input.serviceName ?? 'reporting-service',
          details: input.details,
          occurredAt,
        });

        await this.repository.writeAudit(input.action, actor.userId, {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        });

        return { auditLog: toAuditLogDto(record) };
      },
    );
  }
}
