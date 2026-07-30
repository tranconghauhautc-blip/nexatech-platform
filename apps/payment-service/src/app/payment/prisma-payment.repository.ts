import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { Prisma } from '../../generated/prisma';
import type { PaymentRepository } from './payment.repository';
import type {
  CreateCallbackInput,
  CreatePaymentInput,
  CreateRefundInput,
  IdempotencyRecord,
  ListPaymentsFilter,
  ListPaymentsResult,
  Payment,
  PaymentCallback,
  UpdatePaymentStatusInput,
} from './payment.types';
import { ACTIVE_PAYMENT_STATUSES } from './payment.types';
import { PrismaService } from './prisma.service';

type PaymentFull = Prisma.PaymentGetPayload<{
  include: {
    attempts: true;
    transactions: true;
    refunds: true;
  };
}>;

const PAYMENT_INCLUDE = {
  attempts: { orderBy: { createdAt: 'asc' as const } },
  transactions: { orderBy: { createdAt: 'asc' as const } },
  refunds: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

function mapPayment(row: PaymentFull): Payment {
  return {
    id: row.id,
    paymentReference: row.paymentReference,
    orderId: row.orderId,
    orderCode: row.orderCode,
    customerId: row.customerId,
    provider: row.provider,
    method: row.method,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    amountRefunded: row.amountRefunded,
    checkoutUrl: row.checkoutUrl ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    paidAt: row.paidAt ?? undefined,
    failureCode: row.failureCode ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    version: row.version,
    orderSyncedAt: row.orderSyncedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attempts: row.attempts.map((a) => ({
      id: a.id,
      paymentId: a.paymentId,
      attemptNumber: a.attemptNumber,
      status: a.status,
      providerReference: a.providerReference ?? undefined,
      failureCode: a.failureCode ?? undefined,
      failureMessage: a.failureMessage ?? undefined,
      createdAt: a.createdAt,
    })),
    transactions: row.transactions.map((t) => ({
      id: t.id,
      paymentId: t.paymentId,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      providerTxnId: t.providerTxnId ?? undefined,
      status: t.status,
      createdAt: t.createdAt,
    })),
    refunds: row.refunds.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      amount: r.amount,
      currency: r.currency,
      reason: r.reason,
      status: r.status,
      refundReference: r.refundReference,
      providerRefundId: r.providerRefundId ?? undefined,
      idempotencyKey: r.idempotencyKey ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.payment.findFirst({
        where: {
          orderId: input.orderId,
          status: { in: [...ACTIVE_PAYMENT_STATUSES] },
        },
      });
      if (active) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_ALREADY_EXISTS,
          message: 'Đơn hàng đã có phiên thanh toán đang hoạt động',
        });
      }

      await tx.payment.create({
        data: {
          id: input.id,
          paymentReference: input.paymentReference,
          orderId: input.orderId,
          orderCode: input.orderCode,
          customerId: input.customerId,
          provider: input.provider,
          method: input.method,
          status: input.status,
          amount: input.amount,
          currency: input.currency,
          checkoutUrl: input.checkoutUrl,
          expiresAt: input.expiresAt,
        },
      });

      await tx.paymentAttempt.create({
        data: {
          id: createId(),
          paymentId: input.id,
          attemptNumber: input.attempt.attemptNumber,
          status: input.attempt.status,
          providerReference: input.attempt.providerReference,
        },
      });

      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((e) => ({
            id: createId(),
            eventType: e.eventType,
            routingKey: e.routingKey,
            payloadJson: e.payload as Prisma.InputJsonValue,
            traceId: e.traceId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          id: createId(),
          action: 'payment.create',
          actorId: input.actorId,
          details: { paymentId: input.id, orderId: input.orderId },
        },
      });

      const row = await tx.payment.findUniqueOrThrow({
        where: { id: input.id },
        include: PAYMENT_INCLUDE,
      });
      return mapPayment(row);
    });
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    return row ? mapPayment(row) : null;
  }

  async findByReference(reference: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({
      where: { paymentReference: reference },
      include: PAYMENT_INCLUDE,
    });
    return row ? mapPayment(row) : null;
  }

  async findActiveByOrderId(orderId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: { in: [...ACTIVE_PAYMENT_STATUSES] },
      },
      include: PAYMENT_INCLUDE,
    });
    return row ? mapPayment(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { orderId },
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapPayment);
  }

  async updateStatus(input: UpdatePaymentStatusInput): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: input.paymentId },
      });
      if (!current) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
          message: 'Không tìm thấy thanh toán',
        });
      }
      if (current.version !== input.expectedVersion) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_CONFLICT,
          message: 'Thanh toán đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          status: input.status,
          version: { increment: 1 },
          paidAt: input.paidAt,
          failureCode: input.failureCode,
          failureMessage: input.failureMessage,
          checkoutUrl: input.checkoutUrl,
          orderSyncedAt: input.orderSyncedAt,
        },
      });

      if (input.attempt) {
        await tx.paymentAttempt.create({
          data: {
            id: createId(),
            paymentId: input.paymentId,
            attemptNumber: input.attempt.attemptNumber,
            status: input.attempt.status,
            providerReference: input.attempt.providerReference,
            failureCode: input.attempt.failureCode,
            failureMessage: input.attempt.failureMessage,
          },
        });
      }

      if (input.transaction) {
        await tx.paymentTransaction.create({
          data: {
            id: createId(),
            paymentId: input.paymentId,
            type: input.transaction.type,
            amount: input.transaction.amount,
            currency: input.transaction.currency,
            providerTxnId: input.transaction.providerTxnId,
            status: input.transaction.status,
          },
        });
      }

      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((e) => ({
            id: createId(),
            eventType: e.eventType,
            routingKey: e.routingKey,
            payloadJson: e.payload as Prisma.InputJsonValue,
            traceId: e.traceId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          id: createId(),
          action: 'payment.status_update',
          actorId: input.actorId,
          details: { paymentId: input.paymentId, status: input.status },
        },
      });

      const row = await tx.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: PAYMENT_INCLUDE,
      });
      return mapPayment(row);
    });
  }

  async list(filter: ListPaymentsFilter): Promise<ListPaymentsResult> {
    const where: Prisma.PaymentWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.provider) where.provider = filter.provider;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }

    let orderBy: Prisma.PaymentOrderByWithRelationInput = { createdAt: 'desc' };
    switch (filter.sort) {
      case 'createdAt_asc':
        orderBy = { createdAt: 'asc' };
        break;
      case 'amount_desc':
        orderBy = { amount: 'desc' };
        break;
      case 'amount_asc':
        orderBy = { amount: 'asc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        include: PAYMENT_INCLUDE,
      }),
    ]);

    return {
      items: rows.map(mapPayment),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async recordCallback(input: CreateCallbackInput): Promise<PaymentCallback> {
    try {
      const row = await this.prisma.paymentCallback.create({
        data: {
          id: createId(),
          paymentId: input.paymentId,
          provider: input.provider,
          payloadHash: input.payloadHash,
          signatureValid: input.signatureValid,
          rawPayloadJson: input.rawPayloadJson as Prisma.InputJsonValue,
          providerTxnId: input.providerTxnId,
          processed: input.processed,
          resultStatus: input.resultStatus,
        },
      });
      return {
        id: row.id,
        paymentId: row.paymentId,
        provider: row.provider,
        payloadHash: row.payloadHash,
        signatureValid: row.signatureValid,
        rawPayloadJson: row.rawPayloadJson as Record<string, unknown>,
        providerTxnId: row.providerTxnId ?? undefined,
        processed: row.processed,
        resultStatus: row.resultStatus,
        createdAt: row.createdAt,
      };
    } catch {
      const existing = await this.prisma.paymentCallback.findUnique({
        where: {
          provider_payloadHash: {
            provider: input.provider,
            payloadHash: input.payloadHash,
          },
        },
      });
      if (!existing) throw new Error('Callback record failed');
      if (input.processed && !existing.processed) {
        await this.prisma.paymentCallback.update({
          where: { id: existing.id },
          data: { processed: true, resultStatus: input.resultStatus },
        });
      }
      return {
        id: existing.id,
        paymentId: existing.paymentId,
        provider: existing.provider,
        payloadHash: existing.payloadHash,
        signatureValid: existing.signatureValid,
        rawPayloadJson: existing.rawPayloadJson as Record<string, unknown>,
        providerTxnId: existing.providerTxnId ?? undefined,
        processed: input.processed || existing.processed,
        resultStatus: input.resultStatus,
        createdAt: existing.createdAt,
      };
    }
  }

  async findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<PaymentCallback | null> {
    const row = await this.prisma.paymentCallback.findUnique({
      where: {
        provider_payloadHash: {
          provider: provider as PaymentCallback['provider'],
          payloadHash,
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      paymentId: row.paymentId,
      provider: row.provider,
      payloadHash: row.payloadHash,
      signatureValid: row.signatureValid,
      rawPayloadJson: row.rawPayloadJson as Record<string, unknown>,
      providerTxnId: row.providerTxnId ?? undefined,
      processed: row.processed,
      resultStatus: row.resultStatus,
      createdAt: row.createdAt,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: input.paymentId },
      });
      if (!current) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
          message: 'Không tìm thấy thanh toán',
        });
      }
      if (current.version !== input.paymentExpectedVersion) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_CONFLICT,
          message: 'Thanh toán đã được cập nhật bởi thao tác khác',
        });
      }

      await tx.refund.create({
        data: {
          id: input.id,
          paymentId: input.paymentId,
          amount: input.amount,
          currency: input.currency,
          reason: input.reason,
          status: input.status,
          refundReference: input.refundReference,
          providerRefundId: input.providerRefundId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          amountRefunded: input.newAmountRefunded,
          status: input.newPaymentStatus,
          version: { increment: 1 },
        },
      });

      if (input.outboxEvents.length) {
        await tx.outboxEvent.createMany({
          data: input.outboxEvents.map((e) => ({
            id: createId(),
            eventType: e.eventType,
            routingKey: e.routingKey,
            payloadJson: e.payload as Prisma.InputJsonValue,
            traceId: e.traceId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          id: createId(),
          action: 'payment.refund',
          actorId: input.actorId,
          details: { paymentId: input.paymentId, refundId: input.id },
        },
      });

      const row = await tx.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: PAYMENT_INCLUDE,
      });
      return mapPayment(row);
    });
  }

  async listRefunds(paymentId: string): Promise<Payment['refunds']> {
    const payment = await this.findById(paymentId);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }
    return payment.refunds;
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.paymentIdempotency.findUnique({
      where: { key },
    });
    if (!row) return null;
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
    await this.prisma.paymentIdempotency.create({
      data: {
        key,
        operation,
        responseJson: response as Prisma.InputJsonValue,
      },
    });
  }

  async addOutbox(
    events: import('./payment.types').OutboxEventInput[],
  ): Promise<void> {
    if (!events.length) return;
    await this.prisma.outboxEvent.createMany({
      data: events.map((e) => ({
        id: createId(),
        eventType: e.eventType,
        routingKey: e.routingKey,
        payloadJson: e.payload as Prisma.InputJsonValue,
        traceId: e.traceId,
      })),
    });
  }

  async listUnpublishedOutbox(limit: number) {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      routingKey: r.routingKey,
      payload: r.payloadJson as Record<string, unknown>,
      traceId: r.traceId,
      publishedAt: r.publishedAt ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
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
}
