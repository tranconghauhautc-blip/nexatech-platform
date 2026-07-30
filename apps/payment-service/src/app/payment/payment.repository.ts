import { createHash } from 'node:crypto';
import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  AuditLogEntry,
  CreateCallbackInput,
  CreatePaymentInput,
  CreateRefundInput,
  IdempotencyRecord,
  ListPaymentsFilter,
  ListPaymentsResult,
  OutboxEventInput,
  OutboxEventRecord,
  Payment,
  PaymentCallback,
  UpdatePaymentStatusInput,
} from './payment.types';
import { ACTIVE_PAYMENT_STATUSES } from './payment.types';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentRepository {
  createPayment(input: CreatePaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByReference(reference: string): Promise<Payment | null>;
  findActiveByOrderId(orderId: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment[]>;
  updateStatus(input: UpdatePaymentStatusInput): Promise<Payment>;
  list(filter: ListPaymentsFilter): Promise<ListPaymentsResult>;
  recordCallback(input: CreateCallbackInput): Promise<PaymentCallback>;
  findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<PaymentCallback | null>;
  createRefund(input: CreateRefundInput): Promise<Payment>;
  listRefunds(paymentId: string): Promise<Payment['refunds']>;
  getIdempotency(key: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(
    key: string,
    operation: string,
    response: unknown,
  ): Promise<void>;
  addOutbox(events: OutboxEventInput[]): Promise<void>;
  listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]>;
  markOutboxPublished(ids: string[]): Promise<void>;
  writeAudit(
    action: string,
    actorId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}

function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    expiresAt: payment.expiresAt ? new Date(payment.expiresAt) : undefined,
    paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
    orderSyncedAt: payment.orderSyncedAt
      ? new Date(payment.orderSyncedAt)
      : undefined,
    createdAt: new Date(payment.createdAt),
    updatedAt: new Date(payment.updatedAt),
    attempts: payment.attempts.map((a) => ({
      ...a,
      createdAt: new Date(a.createdAt),
    })),
    transactions: payment.transactions.map((t) => ({
      ...t,
      createdAt: new Date(t.createdAt),
    })),
    refunds: payment.refunds.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
  };
}

function assertVersion(payment: Payment, expectedVersion: number): void {
  if (payment.version !== expectedVersion) {
    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_CONFLICT,
      message: 'Thanh toán đã được cập nhật bởi thao tác khác',
      details: { expectedVersion, actualVersion: payment.version },
    });
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private payments = new Map<string, Payment>();
  private byReference = new Map<string, string>();
  private callbacks = new Map<string, PaymentCallback>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private outbox = new Map<string, OutboxEventRecord>();
  private audits: AuditLogEntry[] = [];

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const active = await this.findActiveByOrderId(input.orderId);
    if (active) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_ALREADY_EXISTS,
        message: 'Đơn hàng đã có phiên thanh toán đang hoạt động',
        details: { orderId: input.orderId, paymentId: active.id },
      });
    }

    const now = new Date();
    const attempt = {
      id: createId(),
      paymentId: input.id,
      attemptNumber: input.attempt.attemptNumber,
      status: input.attempt.status,
      providerReference: input.attempt.providerReference,
      failureCode: undefined,
      failureMessage: undefined,
      createdAt: now,
    };

    const payment: Payment = {
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
      amountRefunded: 0,
      checkoutUrl: input.checkoutUrl,
      expiresAt: input.expiresAt,
      paidAt: undefined,
      failureCode: undefined,
      failureMessage: undefined,
      version: 0,
      orderSyncedAt: undefined,
      createdAt: now,
      updatedAt: now,
      attempts: [attempt],
      transactions: [],
      refunds: [],
    };

    this.payments.set(payment.id, payment);
    this.byReference.set(payment.paymentReference, payment.id);
    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('payment.create', input.actorId, {
      paymentId: payment.id,
      orderId: payment.orderId,
    });
    return clonePayment(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    const payment = this.payments.get(id);
    return payment ? clonePayment(payment) : null;
  }

  async findByReference(reference: string): Promise<Payment | null> {
    const id = this.byReference.get(reference);
    return id ? this.findById(id) : null;
  }

  async findActiveByOrderId(orderId: string): Promise<Payment | null> {
    const payment = [...this.payments.values()].find(
      (p) =>
        p.orderId === orderId && ACTIVE_PAYMENT_STATUSES.includes(p.status),
    );
    return payment ? clonePayment(payment) : null;
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return [...this.payments.values()]
      .filter((p) => p.orderId === orderId)
      .map(clonePayment);
  }

  async updateStatus(input: UpdatePaymentStatusInput): Promise<Payment> {
    const payment = this.payments.get(input.paymentId);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }
    assertVersion(payment, input.expectedVersion);

    payment.status = input.status;
    payment.version += 1;
    payment.updatedAt = new Date();
    if (input.paidAt !== undefined) payment.paidAt = input.paidAt;
    if (input.failureCode !== undefined)
      payment.failureCode = input.failureCode;
    if (input.failureMessage !== undefined)
      payment.failureMessage = input.failureMessage;
    if (input.checkoutUrl !== undefined)
      payment.checkoutUrl = input.checkoutUrl;
    if (input.orderSyncedAt !== undefined)
      payment.orderSyncedAt = input.orderSyncedAt;

    if (input.attempt) {
      payment.attempts.push({
        id: createId(),
        paymentId: payment.id,
        attemptNumber: input.attempt.attemptNumber,
        status: input.attempt.status,
        providerReference: input.attempt.providerReference,
        failureCode: input.attempt.failureCode,
        failureMessage: input.attempt.failureMessage,
        createdAt: new Date(),
      });
    }

    if (input.transaction) {
      payment.transactions.push({
        id: createId(),
        paymentId: payment.id,
        type: input.transaction.type,
        amount: input.transaction.amount,
        currency: input.transaction.currency,
        providerTxnId: input.transaction.providerTxnId,
        status: input.transaction.status,
        createdAt: new Date(),
      });
    }

    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('payment.status_update', input.actorId, {
      paymentId: payment.id,
      status: input.status,
    });
    return clonePayment(payment);
  }

  async list(filter: ListPaymentsFilter): Promise<ListPaymentsResult> {
    let items = [...this.payments.values()];
    if (filter.status) items = items.filter((p) => p.status === filter.status);
    if (filter.provider)
      items = items.filter((p) => p.provider === filter.provider);
    if (filter.orderId)
      items = items.filter((p) => p.orderId === filter.orderId);
    if (filter.customerId)
      items = items.filter((p) => p.customerId === filter.customerId);
    if (filter.from) {
      const from = filter.from;
      items = items.filter((p) => p.createdAt >= from);
    }
    if (filter.to) {
      const to = filter.to;
      items = items.filter((p) => p.createdAt <= to);
    }

    items.sort((a, b) => {
      switch (filter.sort) {
        case 'createdAt_asc':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const pageItems = items
      .slice(start, start + filter.pageSize)
      .map(clonePayment);
    return {
      items: pageItems,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async recordCallback(input: CreateCallbackInput): Promise<PaymentCallback> {
    const key = `${input.provider}:${input.payloadHash}`;
    const existing = this.callbacks.get(key);
    if (existing) {
      if (input.processed) {
        existing.processed = true;
        existing.resultStatus = input.resultStatus;
      }
      return { ...existing };
    }

    const callback: PaymentCallback = {
      id: createId(),
      paymentId: input.paymentId,
      provider: input.provider,
      payloadHash: input.payloadHash,
      signatureValid: input.signatureValid,
      rawPayloadJson: { ...input.rawPayloadJson },
      providerTxnId: input.providerTxnId,
      processed: input.processed,
      resultStatus: input.resultStatus,
      createdAt: new Date(),
    };
    this.callbacks.set(key, callback);
    return { ...callback };
  }

  async findCallbackByHash(
    provider: string,
    payloadHash: string,
  ): Promise<PaymentCallback | null> {
    const callback = this.callbacks.get(`${provider}:${payloadHash}`);
    return callback ? { ...callback } : null;
  }

  async createRefund(input: CreateRefundInput): Promise<Payment> {
    const payment = this.payments.get(input.paymentId);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }
    assertVersion(payment, input.paymentExpectedVersion);

    const now = new Date();
    payment.refunds.push({
      id: input.id,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      status: input.status,
      refundReference: input.refundReference,
      providerRefundId: input.providerRefundId,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    payment.amountRefunded = input.newAmountRefunded;
    payment.status = input.newPaymentStatus;
    payment.version += 1;
    payment.updatedAt = now;

    await this.addOutbox(input.outboxEvents);
    await this.writeAudit('payment.refund', input.actorId, {
      paymentId: payment.id,
      refundId: input.id,
      amount: input.amount,
    });
    return clonePayment(payment);
  }

  async listRefunds(paymentId: string): Promise<Payment['refunds']> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }
    return payment.refunds.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
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
    this.idempotency.set(key, {
      key,
      operation,
      response,
      createdAt: new Date(),
    });
  }

  async addOutbox(events: OutboxEventInput[]): Promise<void> {
    const now = new Date();
    for (const event of events) {
      const id = createId();
      this.outbox.set(id, {
        id,
        ...event,
        createdAt: now,
      });
    }
  }

  async listUnpublishedOutbox(limit: number): Promise<OutboxEventRecord[]> {
    return [...this.outbox.values()]
      .filter((e) => !e.publishedAt)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  async markOutboxPublished(ids: string[]): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const event = this.outbox.get(id);
      if (event) event.publishedAt = now;
    }
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

export function hashCallbackPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function generatePaymentReference(orderCode: string): string {
  const suffix = createId().replace(/-/g, '').slice(0, 8).toUpperCase();
  const codePart = orderCode
    .replace(/[^A-Z0-9]/gi, '')
    .slice(-6)
    .toUpperCase();
  return `PAY-${codePart}-${suffix}`;
}

export function generateRefundReference(paymentReference: string): string {
  const suffix = createId().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `RF-${paymentReference}-${suffix}`;
}
