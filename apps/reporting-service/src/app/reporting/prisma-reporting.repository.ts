import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from './prisma.service';
import type { ReportingRepository } from './reporting.repository';
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

function toStatusMap(
  groups: Array<{ status: string; _count: { _all: number } }>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const group of groups) {
    result[group.status] = group._count._all;
  }
  return result;
}

type PrismaOrderRow = Awaited<
  ReturnType<PrismaService['orderProjection']['findFirstOrThrow']>
>;
type PrismaPaymentRow = Awaited<
  ReturnType<PrismaService['paymentProjection']['findFirstOrThrow']>
>;
type PrismaShipmentRow = Awaited<
  ReturnType<PrismaService['shipmentProjection']['findFirstOrThrow']>
>;
type PrismaReviewRow = Awaited<
  ReturnType<PrismaService['reviewProjection']['findFirstOrThrow']>
>;
type PrismaClaimRow = Awaited<
  ReturnType<PrismaService['warrantyClaimProjection']['findFirstOrThrow']>
>;
type PrismaReturnRow = Awaited<
  ReturnType<PrismaService['warrantyReturnProjection']['findFirstOrThrow']>
>;
type PrismaTicketRow = Awaited<
  ReturnType<PrismaService['supportTicketProjection']['findFirstOrThrow']>
>;
type PrismaDailyMetricRow = Awaited<
  ReturnType<PrismaService['dailyMetric']['findFirstOrThrow']>
>;
type PrismaAuditLogRow = Awaited<
  ReturnType<PrismaService['auditLogProjection']['findFirstOrThrow']>
>;

function mapOrder(row: PrismaOrderRow): OrderProjectionRecord {
  return {
    orderId: row.orderId,
    orderCode: row.orderCode ?? undefined,
    customerId: row.customerId ?? undefined,
    status: row.status,
    grandTotal: row.grandTotal,
    totalQuantity: row.totalQuantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
    lastEventId: row.lastEventId ?? undefined,
  };
}

function mapPayment(row: PrismaPaymentRow): PaymentProjectionRecord {
  return {
    paymentId: row.paymentId,
    orderId: row.orderId ?? undefined,
    status: row.status,
    amount: row.amount,
    method: row.method ?? undefined,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapShipment(row: PrismaShipmentRow): ShipmentProjectionRecord {
  return {
    shipmentId: row.shipmentId,
    orderId: row.orderId ?? undefined,
    status: row.status,
    carrierCode: row.carrierCode ?? undefined,
    trackingCode: row.trackingCode ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapReview(row: PrismaReviewRow): ReviewProjectionRecord {
  return {
    reviewId: row.reviewId,
    productId: row.productId ?? undefined,
    customerId: row.customerId ?? undefined,
    status: row.status,
    rating: row.rating ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapClaim(row: PrismaClaimRow): WarrantyClaimProjectionRecord {
  return {
    claimId: row.claimId,
    orderId: row.orderId ?? undefined,
    customerId: row.customerId ?? undefined,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapReturn(row: PrismaReturnRow): WarrantyReturnProjectionRecord {
  return {
    returnId: row.returnId,
    orderId: row.orderId ?? undefined,
    customerId: row.customerId ?? undefined,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapTicket(row: PrismaTicketRow): SupportTicketProjectionRecord {
  return {
    ticketId: row.ticketId,
    ticketCode: row.ticketCode ?? undefined,
    customerId: row.customerId ?? undefined,
    status: row.status,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastEventType: row.lastEventType ?? undefined,
  };
}

function mapDailyMetric(row: PrismaDailyMetricRow): DailyMetricRecord {
  return {
    id: row.id,
    metricDate: row.metricDate,
    domain: row.domain,
    metricKey: row.metricKey,
    value: row.value,
  };
}

function mapAuditLog(row: PrismaAuditLogRow): AuditLogProjectionRecord {
  return {
    id: row.id,
    sourceEventId: row.sourceEventId ?? undefined,
    action: row.action,
    actorId: row.actorId ?? undefined,
    actorRoles: row.actorRoles
      ? row.actorRoles.split(',').filter(Boolean)
      : undefined,
    resourceType: row.resourceType ?? undefined,
    resourceId: row.resourceId ?? undefined,
    serviceName: row.serviceName ?? undefined,
    details: (row.detailsJson as Record<string, unknown> | null) ?? undefined,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

export class PrismaReportingRepository implements ReportingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertOrderProjection(
    input: UpsertOrderProjectionInput,
  ): Promise<void> {
    await this.prisma.orderProjection.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        orderCode: input.orderCode,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        grandTotal: input.grandTotal ?? 0,
        totalQuantity: input.totalQuantity ?? 0,
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
        lastEventId: input.lastEventId,
      },
      update: {
        ...(input.orderCode !== undefined && { orderCode: input.orderCode }),
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.grandTotal !== undefined && {
          grandTotal: input.grandTotal,
        }),
        ...(input.totalQuantity !== undefined && {
          totalQuantity: input.totalQuantity,
        }),
        lastEventType: input.lastEventType,
        lastEventId: input.lastEventId,
      },
    });
  }

  async upsertPaymentProjection(
    input: UpsertPaymentProjectionInput,
  ): Promise<void> {
    await this.prisma.paymentProjection.upsert({
      where: { paymentId: input.paymentId },
      create: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        status: input.status ?? 'UNKNOWN',
        amount: input.amount ?? 0,
        method: input.method,
        currency: input.currency ?? 'VND',
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.orderId !== undefined && { orderId: input.orderId }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.method !== undefined && { method: input.method }),
        ...(input.currency !== undefined && { currency: input.currency }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async upsertShipmentProjection(
    input: UpsertShipmentProjectionInput,
  ): Promise<void> {
    await this.prisma.shipmentProjection.upsert({
      where: { shipmentId: input.shipmentId },
      create: {
        shipmentId: input.shipmentId,
        orderId: input.orderId,
        status: input.status ?? 'UNKNOWN',
        carrierCode: input.carrierCode,
        trackingCode: input.trackingCode,
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.orderId !== undefined && { orderId: input.orderId }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.carrierCode !== undefined && {
          carrierCode: input.carrierCode,
        }),
        ...(input.trackingCode !== undefined && {
          trackingCode: input.trackingCode,
        }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async upsertReviewProjection(
    input: UpsertReviewProjectionInput,
  ): Promise<void> {
    await this.prisma.reviewProjection.upsert({
      where: { reviewId: input.reviewId },
      create: {
        reviewId: input.reviewId,
        productId: input.productId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        rating: input.rating,
        deletedAt: input.deletedAt,
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.productId !== undefined && { productId: input.productId }),
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.rating !== undefined && { rating: input.rating }),
        ...(input.deletedAt !== undefined && { deletedAt: input.deletedAt }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async upsertWarrantyClaimProjection(
    input: UpsertWarrantyClaimProjectionInput,
  ): Promise<void> {
    await this.prisma.warrantyClaimProjection.upsert({
      where: { claimId: input.claimId },
      create: {
        claimId: input.claimId,
        orderId: input.orderId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.orderId !== undefined && { orderId: input.orderId }),
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.status !== undefined && { status: input.status }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async upsertWarrantyReturnProjection(
    input: UpsertWarrantyReturnProjectionInput,
  ): Promise<void> {
    await this.prisma.warrantyReturnProjection.upsert({
      where: { returnId: input.returnId },
      create: {
        returnId: input.returnId,
        orderId: input.orderId,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.orderId !== undefined && { orderId: input.orderId }),
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.status !== undefined && { status: input.status }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async upsertSupportTicketProjection(
    input: UpsertSupportTicketProjectionInput,
  ): Promise<void> {
    await this.prisma.supportTicketProjection.upsert({
      where: { ticketId: input.ticketId },
      create: {
        ticketId: input.ticketId,
        ticketCode: input.ticketCode,
        customerId: input.customerId,
        status: input.status ?? 'UNKNOWN',
        priority: input.priority,
        category: input.category,
        createdAt: input.occurredAt,
        lastEventType: input.lastEventType,
      },
      update: {
        ...(input.ticketCode !== undefined && {
          ticketCode: input.ticketCode,
        }),
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.category !== undefined && { category: input.category }),
        lastEventType: input.lastEventType,
      },
    });
  }

  async incrementDailyMetric(
    metricDate: Date,
    domain: string,
    metricKey: string,
    incrementBy: number,
  ): Promise<void> {
    await this.prisma.dailyMetric.upsert({
      where: {
        metricDate_domain_metricKey: { metricDate, domain, metricKey },
      },
      create: {
        metricDate,
        domain,
        metricKey,
        value: BigInt(incrementBy),
      },
      update: {
        value: { increment: BigInt(incrementBy) },
      },
    });
  }

  async insertAuditLogProjection(
    input: InsertAuditLogProjectionInput,
  ): Promise<AuditLogProjectionRecord> {
    if (input.sourceEventId) {
      const existing = await this.prisma.auditLogProjection.findUnique({
        where: { sourceEventId: input.sourceEventId },
      });
      if (existing) {
        return mapAuditLog(existing);
      }
    }
    try {
      const row = await this.prisma.auditLogProjection.create({
        data: {
          id: createId(),
          sourceEventId: input.sourceEventId,
          action: input.action,
          actorId: input.actorId,
          actorRoles: input.actorRoles?.join(','),
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          serviceName: input.serviceName,
          detailsJson: input.details as Prisma.InputJsonValue | undefined,
          occurredAt: input.occurredAt,
        },
      });
      return mapAuditLog(row);
    } catch (error) {
      if (isUniqueViolation(error) && input.sourceEventId) {
        const existing = await this.prisma.auditLogProjection.findUniqueOrThrow(
          { where: { sourceEventId: input.sourceEventId } },
        );
        return mapAuditLog(existing);
      }
      throw error;
    }
  }

  async listOrderProjections(
    filter: ListOrderProjectionFilter,
  ): Promise<ListResult<OrderProjectionRecord>> {
    const where: Prisma.OrderProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.orderProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.orderProjection.count({ where }),
    ]);
    return { items: rows.map(mapOrder), totalItems };
  }

  async listPaymentProjections(
    filter: ListPaymentProjectionFilter,
  ): Promise<ListResult<PaymentProjectionRecord>> {
    const where: Prisma.PaymentProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderId) where.orderId = filter.orderId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.paymentProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.paymentProjection.count({ where }),
    ]);
    return { items: rows.map(mapPayment), totalItems };
  }

  async listShipmentProjections(
    filter: ListShipmentProjectionFilter,
  ): Promise<ListResult<ShipmentProjectionRecord>> {
    const where: Prisma.ShipmentProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderId) where.orderId = filter.orderId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.shipmentProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.shipmentProjection.count({ where }),
    ]);
    return { items: rows.map(mapShipment), totalItems };
  }

  async listReviewProjections(
    filter: ListReviewProjectionFilter,
  ): Promise<ListResult<ReviewProjectionRecord>> {
    const where: Prisma.ReviewProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.productId) where.productId = filter.productId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.reviewProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.reviewProjection.count({ where }),
    ]);
    return { items: rows.map(mapReview), totalItems };
  }

  async listWarrantyClaimProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyClaimProjectionRecord>> {
    const where: Prisma.WarrantyClaimProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.warrantyClaimProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.warrantyClaimProjection.count({ where }),
    ]);
    return { items: rows.map(mapClaim), totalItems };
  }

  async listWarrantyReturnProjections(
    filter: ListWarrantyProjectionFilter,
  ): Promise<ListResult<WarrantyReturnProjectionRecord>> {
    const where: Prisma.WarrantyReturnProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.warrantyReturnProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.warrantyReturnProjection.count({ where }),
    ]);
    return { items: rows.map(mapReturn), totalItems };
  }

  async listSupportTicketProjections(
    filter: ListSupportTicketProjectionFilter,
  ): Promise<ListResult<SupportTicketProjectionRecord>> {
    const where: Prisma.SupportTicketProjectionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    const [rows, totalItems] = await Promise.all([
      this.prisma.supportTicketProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.supportTicketProjection.count({ where }),
    ]);
    return { items: rows.map(mapTicket), totalItems };
  }

  async listAuditLogs(
    filter: ListAuditLogsFilter,
  ): Promise<ListResult<AuditLogProjectionRecord>> {
    const where: Prisma.AuditLogProjectionWhereInput = {};
    if (filter.action) where.action = filter.action;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.resourceType) where.resourceType = filter.resourceType;
    if (filter.resourceId) where.resourceId = filter.resourceId;
    if (filter.dateFrom || filter.dateTo) {
      where.occurredAt = {
        ...(filter.dateFrom && { gte: filter.dateFrom }),
        ...(filter.dateTo && { lte: filter.dateTo }),
      };
    }
    const [rows, totalItems] = await Promise.all([
      this.prisma.auditLogProjection.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.auditLogProjection.count({ where }),
    ]);
    return { items: rows.map(mapAuditLog), totalItems };
  }

  async listDailyMetrics(
    filter: ListDailyMetricsFilter,
  ): Promise<ListResult<DailyMetricRecord>> {
    const where: Prisma.DailyMetricWhereInput = {};
    if (filter.domain) where.domain = filter.domain;
    if (filter.dateFrom || filter.dateTo) {
      where.metricDate = {
        ...(filter.dateFrom && { gte: filter.dateFrom }),
        ...(filter.dateTo && { lte: filter.dateTo }),
      };
    }
    const [rows, totalItems] = await Promise.all([
      this.prisma.dailyMetric.findMany({
        where,
        orderBy: { metricDate: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.dailyMetric.count({ where }),
    ]);
    return { items: rows.map(mapDailyMetric), totalItems };
  }

  async getDashboardSummary(): Promise<DashboardSummaryRaw> {
    const countAll = { _count: { _all: true } as const };
    const [
      totalOrders,
      ordersByStatusRaw,
      totalPayments,
      paymentsByStatusRaw,
      totalShipments,
      shipmentsByStatusRaw,
      totalReviews,
      reviewsByStatusRaw,
      totalWarrantyClaims,
      claimsByStatusRaw,
      totalWarrantyReturns,
      returnsByStatusRaw,
      totalSupportTickets,
      ticketsByStatusRaw,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.orderProjection.count(),
      this.prisma.orderProjection.groupBy({ by: ['status'], ...countAll }),
      this.prisma.paymentProjection.count(),
      this.prisma.paymentProjection.groupBy({ by: ['status'], ...countAll }),
      this.prisma.shipmentProjection.count(),
      this.prisma.shipmentProjection.groupBy({ by: ['status'], ...countAll }),
      this.prisma.reviewProjection.count(),
      this.prisma.reviewProjection.groupBy({ by: ['status'], ...countAll }),
      this.prisma.warrantyClaimProjection.count(),
      this.prisma.warrantyClaimProjection.groupBy({
        by: ['status'],
        ...countAll,
      }),
      this.prisma.warrantyReturnProjection.count(),
      this.prisma.warrantyReturnProjection.groupBy({
        by: ['status'],
        ...countAll,
      }),
      this.prisma.supportTicketProjection.count(),
      this.prisma.supportTicketProjection.groupBy({
        by: ['status'],
        ...countAll,
      }),
      this.prisma.dailyMetric.aggregate({
        where: { domain: 'PAYMENT', metricKey: 'revenue_vnd' },
        _sum: { value: true },
      }),
    ]);

    return {
      totalOrders,
      ordersByStatus: toStatusMap(ordersByStatusRaw),
      totalRevenue: revenueAgg._sum.value ?? BigInt(0),
      totalPayments,
      paymentsByStatus: toStatusMap(paymentsByStatusRaw),
      totalShipments,
      shipmentsByStatus: toStatusMap(shipmentsByStatusRaw),
      totalReviews,
      reviewsByStatus: toStatusMap(reviewsByStatusRaw),
      totalWarrantyClaims,
      warrantyClaimsByStatus: toStatusMap(claimsByStatusRaw),
      totalWarrantyReturns,
      warrantyReturnsByStatus: toStatusMap(returnsByStatusRaw),
      totalSupportTickets,
      supportTicketsByStatus: toStatusMap(ticketsByStatusRaw),
    };
  }

  async tryMarkProcessed(
    eventId: string,
    eventType: string,
    routingKey?: string,
    result?: unknown,
  ): Promise<boolean> {
    try {
      await this.prisma.processedEvent.create({
        data: {
          eventId,
          eventType,
          routingKey,
          resultJson: result as Prisma.InputJsonValue | undefined,
        },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const row = await this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return Boolean(row);
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.reportingIdempotency.findUnique({
      where: { key },
    });
    if (!row) {
      return null;
    }
    return {
      key: row.key,
      operation: row.operation,
      response: row.responseJson,
      createdAt: row.createdAt,
    };
  }

  async saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void> {
    try {
      await this.prisma.reportingIdempotency.create({
        data: {
          key,
          operation,
          responseJson: response as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          errorCode: ErrorCodes.REPORTING_IDEMPOTENCY_CONFLICT,
          message: 'Idempotency key đã được sử dụng',
        });
      }
      throw error;
    }
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
}
