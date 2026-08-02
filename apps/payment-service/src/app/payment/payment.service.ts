import {
  cancelPaymentRequestSchema,
  createPaginatedResponse,
  createPaymentRequestSchema,
  createRefundRequestSchema,
  listPaymentsQuerySchema,
  type CancelPaymentRequest,
  type CreatePaymentRequest,
  type CreateRefundRequest,
  type ListPaymentsQuery,
  type PaginatedResponse,
  type PaymentDto,
  type RefundDto,
} from '@nexatech/shared-contracts';
import {
  hasMinimumRole,
  isRole,
  isStaff,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  acceptPaymentAmount,
  acceptWebhookSignature,
  enforceResourceOwnership,
  shouldRejectDuplicateCallback,
} from '@nexatech/shared-security-lab';
import {
  EventTypes,
  routingKeyFor,
  type EventType,
} from '@nexatech/shared-events';
import { createId, createTraceId } from '@nexatech/shared-platform';
import { ZodError } from 'zod';
import type { OrderClient } from './order.client';
import type { PaymentEventPublisher } from './event-publisher';
import { addVnd, assertRefundAmount } from './money';
import { OutboxDispatcher } from './outbox.dispatcher';
import { assertPaymentTransition } from './payment-state-machine';
import type { PaymentRepository } from './payment.repository';
import {
  generatePaymentReference,
  generateRefundReference,
  hashCallbackPayload,
} from './payment.repository';
import type {
  OrderClientHeaders,
  OutboxEventInput,
  Payment,
  PaymentStatus,
} from './payment.types';
import { ACTIVE_PAYMENT_STATUSES } from './payment.types';
import { CodProvider } from './providers/cod.provider';
import { MockProvider, isMockPaymentEnabled } from './providers/mock.provider';
import type {
  PaymentProviderAdapter,
  RefundAdapter,
} from './providers/payment-provider';
import {
  VnpayProvider,
  sanitizeVnpayPayload,
  verifyVnpaySignature,
} from './providers/vnpay.provider';

function parseOrThrow<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Dữ liệu không hợp lệ',
        details: { issues: error.issues },
      });
    }
    throw error;
  }
}

export function parseRolesHeader(value?: string): Role[] {
  if (!value) return [];
  return value
    .split(',')
    .map((r) => r.trim())
    .filter(isRole);
}

export interface PaymentActor {
  userId?: string;
  customerId?: string;
  roles: Role[];
}

export function parseActor(
  userId?: string,
  rolesHeader?: string,
): PaymentActor {
  const trimmed = userId?.trim() || undefined;
  return {
    userId: trimmed,
    customerId: trimmed,
    roles: parseRolesHeader(rolesHeader),
  };
}

function requireCustomerId(actor: PaymentActor): string {
  const id = actor.customerId ?? actor.userId;
  if (!id) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Cần đăng nhập',
    });
  }
  return id;
}

function actorIdOf(actor: PaymentActor): string {
  return actor.customerId ?? actor.userId ?? 'system';
}

function isPayableOrder(orderStatus: string, paymentMethod: string): boolean {
  if (paymentMethod === 'COD') {
    return orderStatus === 'CONFIRMED';
  }
  return orderStatus === 'AWAITING_PAYMENT';
}

function providerForMethod(method: string): 'COD' | 'MOCK' | 'VNPAY' {
  return method as 'COD' | 'MOCK' | 'VNPAY';
}

function eventForStatus(status: PaymentStatus): EventType {
  const map: Partial<Record<PaymentStatus, EventType>> = {
    CREATED: EventTypes.PAYMENT_CREATED,
    PENDING: EventTypes.PAYMENT_PENDING,
    PROCESSING: EventTypes.PAYMENT_PROCESSING,
    PAID: EventTypes.PAYMENT_PAID,
    FAILED: EventTypes.PAYMENT_FAILED,
    CANCELLED: EventTypes.PAYMENT_CANCELLED,
    EXPIRED: EventTypes.PAYMENT_EXPIRED,
    REFUND_PENDING: EventTypes.PAYMENT_REFUND_REQUESTED,
    REFUNDED: EventTypes.PAYMENT_REFUNDED,
    PARTIALLY_REFUNDED: EventTypes.PAYMENT_PARTIALLY_REFUNDED,
  };
  return map[status] ?? EventTypes.PAYMENT_CREATED;
}

function buildOutboxEvent(
  payment: Payment,
  status: PaymentStatus,
  traceId: string,
): OutboxEventInput {
  const eventType = eventForStatus(status);
  return {
    eventType,
    routingKey: routingKeyFor(eventType),
    traceId,
    payload: {
      paymentId: payment.id,
      paymentReference: payment.paymentReference,
      orderId: payment.orderId,
      orderCode: payment.orderCode,
      customerId: payment.customerId,
      status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      method: payment.method,
    },
  };
}

function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    paymentReference: payment.paymentReference,
    orderId: payment.orderId,
    orderCode: payment.orderCode,
    customerId: payment.customerId,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    currency: 'VND',
    amountRefunded: payment.amountRefunded,
    checkoutUrl: payment.checkoutUrl,
    expiresAt: payment.expiresAt?.toISOString(),
    paidAt: payment.paidAt?.toISOString(),
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
    version: payment.version,
    attempts: payment.attempts.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      providerReference: a.providerReference,
      failureCode: a.failureCode,
      failureMessage: a.failureMessage,
      createdAt: a.createdAt.toISOString(),
    })),
    transactions: payment.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      providerTxnId: t.providerTxnId,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })),
    refunds: payment.refunds.map(toRefundDto),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

function toRefundDto(refund: Payment['refunds'][number]): RefundDto {
  return {
    id: refund.id,
    paymentId: refund.paymentId,
    amount: refund.amount,
    currency: refund.currency as 'VND',
    reason: refund.reason,
    status: refund.status,
    refundReference: refund.refundReference,
    providerRefundId: refund.providerRefundId,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  };
}

export class PaymentService {
  private readonly outbox: OutboxDispatcher;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly callbackLocks = new Map<
    string,
    Promise<{ payment: Payment }>
  >();
  private readonly codProvider = new CodProvider();
  private readonly mockProvider: MockProvider;
  private readonly vnpayProvider: VnpayProvider;

  constructor(
    private readonly repository: PaymentRepository,
    private readonly orderClient: OrderClient,
    publisher: PaymentEventPublisher,
    private readonly refundAdapter: RefundAdapter,
    mockPublicBaseUrl?: string,
    vnpayProvider?: VnpayProvider,
  ) {
    this.outbox = new OutboxDispatcher(repository, publisher);
    const baseUrl =
      mockPublicBaseUrl ??
      process.env['PAYMENT_PUBLIC_BASE_URL'] ??
      'http://localhost:3008';
    this.mockProvider = new MockProvider(baseUrl);
    this.vnpayProvider =
      vnpayProvider ??
      new VnpayProvider({
        tmnCode: process.env['VNPAY_TMN_CODE'] ?? 'TESTTMN',
        hashSecret: process.env['VNPAY_HASH_SECRET'] ?? 'TESTSECRET',
        paymentUrl:
          process.env['VNPAY_PAYMENT_URL'] ??
          'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        returnUrl:
          process.env['VNPAY_RETURN_URL'] ??
          process.env['PAYMENT_RETURN_URL'] ??
          `${baseUrl}/api/v1/vnpay/return`,
        ipnUrl:
          process.env['VNPAY_IPN_URL'] ??
          process.env['PAYMENT_IPN_URL'] ??
          `${baseUrl}/api/v1/vnpay/ipn`,
      });
  }

  private providerAdapter(method: string): PaymentProviderAdapter {
    switch (method) {
      case 'COD':
        return this.codProvider;
      case 'MOCK':
        return this.mockProvider;
      case 'VNPAY':
        return this.vnpayProvider;
      default:
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_INVALID_METHOD,
          message: 'Phương thức thanh toán không được hỗ trợ',
        });
    }
  }

  private clientHeaders(
    actor: PaymentActor,
    traceId?: string,
  ): OrderClientHeaders {
    return {
      userId: actor.userId,
      roles: actor.roles,
      traceId,
    };
  }

  async createPayment(actor: PaymentActor, raw: unknown): Promise<PaymentDto> {
    const customerId = requireCustomerId(actor);
    const input = parseOrThrow(() => createPaymentRequestSchema.parse(raw));
    return this.withIdempotency(input.idempotencyKey, 'payment.create', () =>
      this.doCreatePayment(customerId, actor, input),
    );
  }

  private async doCreatePayment(
    customerId: string,
    actor: PaymentActor,
    input: CreatePaymentRequest,
  ): Promise<PaymentDto> {
    return this.withOrderCreateLock(input.orderId, async () => {
      const traceId = createTraceId();
      const order = await this.orderClient.getOrder(
        input.orderId,
        this.clientHeaders(actor, traceId),
      );

      if (order.customerId !== customerId && !isStaff(actor.roles)) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_FORBIDDEN,
          message: 'Không có quyền thanh toán đơn hàng này',
        });
      }

      const method = input.method ?? order.paymentMethod;
      if (method !== order.paymentMethod) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_INVALID_METHOD,
          message: 'Phương thức thanh toán không khớp với đơn hàng',
        });
      }

      if (!isPayableOrder(order.status, method)) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_ORDER_NOT_PAYABLE,
          message: 'Đơn hàng không ở trạng thái có thể thanh toán',
          details: { orderStatus: order.status, paymentMethod: method },
        });
      }

      const existing = await this.repository.findActiveByOrderId(input.orderId);
      if (existing) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_ALREADY_EXISTS,
          message: 'Đơn hàng đã có phiên thanh toán đang hoạt động',
          details: { paymentId: existing.id },
        });
      }

      const provider = providerForMethod(method);
      const adapter = this.providerAdapter(method);
      const paymentId = createId();
      const paymentReference = generatePaymentReference(order.orderCode);
      const amount = order.grandTotal;

      const session = await adapter.createSession({
        paymentId,
        paymentReference,
        orderId: order.id,
        orderCode: order.orderCode,
        amount,
        currency: order.currency,
        returnUrl: input.returnUrl,
      });

      const status = session.status;
      const payment = await this.repository.createPayment({
        id: paymentId,
        paymentReference,
        orderId: order.id,
        orderCode: order.orderCode,
        customerId: order.customerId,
        provider,
        method,
        status,
        amount,
        currency: order.currency,
        checkoutUrl: session.checkoutUrl,
        expiresAt: session.expiresAt,
        attempt: {
          attemptNumber: 1,
          status: session.attemptStatus,
          providerReference: session.providerReference,
        },
        outboxEvents: [
          buildOutboxEvent(
            {
              id: paymentId,
              paymentReference,
              orderId: order.id,
              orderCode: order.orderCode,
              customerId: order.customerId,
              provider,
              method,
              status,
              amount,
              currency: order.currency,
              amountRefunded: 0,
              version: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              attempts: [],
              transactions: [],
              refunds: [],
            },
            status,
            traceId,
          ),
        ],
        actorId: actorIdOf(actor),
      });

      await this.outbox.dispatchPending();
      return toPaymentDto(payment);
    });
  }

  private async withOrderCreateLock<T>(
    orderId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = `create:${orderId}`;
    if (this.inFlight.has(key)) {
      await this.inFlight.get(key);
    }
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  async getPayment(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<PaymentDto> {
    const payment = await this.requirePayment(paymentId);
    this.assertOwnership(actor, payment);
    await this.maybeExpire(payment);
    const fresh = (await this.repository.findById(paymentId)) ?? payment;
    return toPaymentDto(fresh);
  }

  async getPaymentByOrder(
    actor: PaymentActor,
    orderId: string,
  ): Promise<PaymentDto | null> {
    const payments = await this.repository.findByOrderId(orderId);
    if (payments.length === 0) return null;
    const sorted = [...payments].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const latest = sorted[0];
    if (!latest) return null;
    this.assertOwnership(actor, latest);
    await this.maybeExpire(latest);
    const fresh = (await this.repository.findById(latest.id)) ?? latest;
    return toPaymentDto(fresh);
  }

  async cancelPayment(
    actor: PaymentActor,
    paymentId: string,
    raw?: unknown,
  ): Promise<PaymentDto> {
    parseOrThrow(() =>
      cancelPaymentRequestSchema.parse(raw ?? {}),
    ) as CancelPaymentRequest;
    const payment = await this.requirePayment(paymentId);
    this.assertOwnership(actor, payment);

    if (ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
      return this.transitionPayment(
        payment,
        'CANCELLED',
        actor,
        undefined,
        undefined,
        undefined,
      );
    }

    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_INVALID_STATUS,
      message: 'Không thể hủy thanh toán ở trạng thái hiện tại',
    });
  }

  async mockSucceed(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<PaymentDto> {
    if (!isMockPaymentEnabled()) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_MOCK_DISABLED,
        message: 'Thanh toán mock đã bị tắt',
      });
    }
    const payment = await this.requirePayment(paymentId);
    if (payment.provider !== 'MOCK') {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_INVALID_METHOD,
        message: 'Chỉ áp dụng cho thanh toán mock',
      });
    }
    await this.maybeExpire(payment);
    const fresh = (await this.repository.findById(paymentId)) ?? payment;
    const paid = await this.markPaid(fresh, actor, 'MOCK-TXN');
    return toPaymentDto(paid);
  }

  async mockFail(actor: PaymentActor, paymentId: string): Promise<PaymentDto> {
    if (!isMockPaymentEnabled()) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_MOCK_DISABLED,
        message: 'Thanh toán mock đã bị tắt',
      });
    }
    const payment = await this.requirePayment(paymentId);
    if (payment.provider !== 'MOCK') {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_INVALID_METHOD,
        message: 'Chỉ áp dụng cho thanh toán mock',
      });
    }
    return this.transitionPayment(
      payment,
      'FAILED',
      actor,
      'MOCK_FAILED',
      'Thanh toán mock thất bại',
      undefined,
    );
  }

  async mockCancel(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<PaymentDto> {
    return this.cancelPayment(actor, paymentId, {});
  }

  async handleVnpayReturn(
    params: Record<string, string>,
  ): Promise<{ payment: PaymentDto; redirectStatus: string }> {
    const result = await this.processVnpayCallback(params, 'return');
    return {
      payment: toPaymentDto(result.payment),
      redirectStatus: result.payment.status,
    };
  }

  async handleVnpayIpn(
    params: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    try {
      await this.processVnpayCallback(params, 'ipn');
      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (error) {
      if (error instanceof AppError) {
        if (error.errorCode === ErrorCodes.PAYMENT_SIGNATURE_INVALID) {
          return { RspCode: '97', Message: 'Invalid Signature' };
        }
        if (error.errorCode === ErrorCodes.PAYMENT_AMOUNT_MISMATCH) {
          return { RspCode: '04', Message: 'Invalid Amount' };
        }
        if (error.errorCode === ErrorCodes.PAYMENT_NOT_FOUND) {
          return { RspCode: '01', Message: 'Order Not Found' };
        }
      }
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  private async processVnpayCallback(
    params: Record<string, string>,
    source: 'return' | 'ipn',
  ): Promise<{ payment: Payment }> {
    void source;
    const reference = params['vnp_TxnRef'];
    if (!reference) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_CALLBACK_INVALID,
        message: 'Thiếu mã tham chiếu VNPay',
      });
    }

    const payloadHash = hashCallbackPayload(params);
    const lockKey = `${reference}:${payloadHash}`;
    const existingLock = this.callbackLocks.get(lockKey);
    if (existingLock) {
      return existingLock;
    }

    const promise = this.doProcessVnpayCallback(
      params,
      reference,
      payloadHash,
    ).finally(() => {
      this.callbackLocks.delete(lockKey);
    });
    this.callbackLocks.set(lockKey, promise);
    return promise;
  }

  private async doProcessVnpayCallback(
    params: Record<string, string>,
    reference: string,
    payloadHash: string,
  ): Promise<{ payment: Payment }> {
    const payment = await this.repository.findByReference(reference);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }

    const existing = await this.repository.findCallbackByHash(
      'VNPAY',
      payloadHash,
    );
    if (existing?.processed) {
      if (shouldRejectDuplicateCallback({ alreadyProcessed: true })) {
        return { payment };
      }
      // lab: fall through and re-process (intentional replay)
    }

    const signatureValid = verifyVnpaySignature(
      params,
      process.env['VNPAY_HASH_SECRET'] ?? 'TESTSECRET',
    );

    await this.repository.recordCallback({
      paymentId: payment.id,
      provider: 'VNPAY',
      payloadHash,
      signatureValid,
      rawPayloadJson: sanitizeVnpayPayload(params),
      providerTxnId: params['vnp_TransactionNo'],
      processed: false,
      resultStatus: 'RECEIVED',
    });

    if (!acceptWebhookSignature({ signatureValid })) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_SIGNATURE_INVALID,
        message: 'Chữ ký VNPay không hợp lệ',
      });
    }

    const amountOk = this.vnpayProvider.verifyAmount(params, payment.amount);
    const callbackAmtRaw = Number(params['vnp_Amount'] ?? NaN);
    const callbackAmountVnd = Number.isFinite(callbackAmtRaw)
      ? Math.round(callbackAmtRaw / 100)
      : -1;
    if (
      !amountOk &&
      !acceptPaymentAmount({
        expectedAmount: payment.amount,
        callbackAmount: callbackAmountVnd,
      })
    ) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
        message: 'Số tiền VNPay không khớp',
      });
    }

    const verify = this.vnpayProvider.verifyCallback(params);
    const systemActor: PaymentActor = {
      userId: 'system',
      roles: [Roles.Admin],
    };

    let updated: Payment;
    if (verify.success) {
      if (payment.status === 'PAID') {
        updated = payment;
      } else {
        updated = await this.markPaid(
          payment,
          systemActor,
          verify.providerTxnId,
        );
      }
    } else if (
      ACTIVE_PAYMENT_STATUSES.includes(payment.status) ||
      payment.status === 'PROCESSING'
    ) {
      await this.transitionPayment(
        payment,
        'FAILED',
        systemActor,
        verify.failureCode,
        verify.failureMessage,
        verify.providerTxnId,
      );
      updated = (await this.repository.findById(payment.id)) ?? payment;
    } else {
      updated = payment;
    }

    await this.repository.recordCallback({
      paymentId: payment.id,
      provider: 'VNPAY',
      payloadHash,
      signatureValid: true,
      rawPayloadJson: sanitizeVnpayPayload(params),
      providerTxnId: params['vnp_TransactionNo'],
      processed: true,
      resultStatus: 'PROCESSED',
    });

    return { payment: updated };
  }

  async markCodCollected(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<PaymentDto> {
    const payment = await this.requirePayment(paymentId);
    if (payment.provider !== 'COD') {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_INVALID_METHOD,
        message: 'Chỉ áp dụng cho thanh toán COD',
      });
    }
    if (payment.status === 'PAID') {
      return toPaymentDto(payment);
    }
    return toPaymentDto(
      await this.markPaid(
        payment,
        actor,
        `COD-${payment.paymentReference}`,
        'payment.cod_collected',
      ),
    );
  }

  async createRefund(
    actor: PaymentActor,
    paymentId: string,
    raw: unknown,
  ): Promise<RefundDto> {
    const input = parseOrThrow(() => createRefundRequestSchema.parse(raw));
    return this.withIdempotency(input.idempotencyKey, 'payment.refund', () =>
      this.doCreateRefund(actor, paymentId, input),
    );
  }

  private async doCreateRefund(
    actor: PaymentActor,
    paymentId: string,
    input: CreateRefundRequest,
  ): Promise<RefundDto> {
    const payment = await this.requirePayment(paymentId);
    this.assertOwnership(actor, payment);

    if (payment.provider === 'COD' && payment.status !== 'PAID') {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_REFUND_NOT_ALLOWED,
        message: 'Không thể hoàn tiền COD chưa thu',
      });
    }

    if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_REFUND_NOT_ALLOWED,
        message: 'Chỉ hoàn tiền khi thanh toán đã thành công',
      });
    }

    const existingRefund = payment.refunds.find(
      (r) => r.idempotencyKey === input.idempotencyKey,
    );
    if (existingRefund) {
      return toRefundDto(existingRefund);
    }

    assertRefundAmount(payment.amount, payment.amountRefunded, input.amount);
    const newAmountRefunded = addVnd(payment.amountRefunded, input.amount);
    const isFullRefund = newAmountRefunded === payment.amount;
    const newStatus: PaymentStatus = isFullRefund
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';

    const refundResult = await this.refundAdapter.requestRefund({
      paymentReference: payment.paymentReference,
      amount: input.amount,
      currency: payment.currency,
      reason: input.reason,
      refundReference: generateRefundReference(payment.paymentReference),
    });

    const traceId = createTraceId();
    const refundId = createId();
    const refundReference = generateRefundReference(payment.paymentReference);

    const updated = await this.repository.createRefund({
      id: refundId,
      paymentId: payment.id,
      amount: input.amount,
      currency: payment.currency,
      reason: input.reason,
      status: refundResult.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'PENDING',
      refundReference,
      providerRefundId: refundResult.providerRefundId,
      idempotencyKey: input.idempotencyKey,
      paymentExpectedVersion: payment.version,
      newPaymentStatus: newStatus,
      newAmountRefunded,
      outboxEvents: [
        buildOutboxEvent(
          { ...payment, status: newStatus, amountRefunded: newAmountRefunded },
          newStatus,
          traceId,
        ),
        // Audit trail vận hành cho reporting — bổ sung song song với ghi
        // log local, không ảnh hưởng kịch bản logging-gap bảo mật (SC-64).
        {
          eventType: EventTypes.AUDIT_RECORDED,
          routingKey: routingKeyFor(EventTypes.AUDIT_RECORDED),
          traceId,
          payload: {
            action: 'payment.refund_created',
            actorId: actorIdOf(actor),
            actorRoles: actor.roles,
            resourceType: 'payment',
            resourceId: payment.id,
            orderId: payment.orderId,
            amount: input.amount,
          },
        },
      ],
      actorId: actorIdOf(actor),
    });

    await this.outbox.dispatchPending();
    const refund = updated.refunds.find((r) => r.id === refundId);
    if (!refund) {
      throw new AppError({
        errorCode: ErrorCodes.INTERNAL_ERROR,
        message: 'Không tạo được hoàn tiền',
      });
    }
    return toRefundDto(refund);
  }

  async listRefunds(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<RefundDto[]> {
    const payment = await this.requirePayment(paymentId);
    this.assertOwnership(actor, payment);
    const refunds = await this.repository.listRefunds(paymentId);
    return refunds.map(toRefundDto);
  }

  async listMyPayments(actor: PaymentActor): Promise<PaymentDto[]> {
    const customerId = requireCustomerId(actor);
    const result = await this.listPaymentsInternal({
      page: 1,
      pageSize: 100,
      customerId,
      sort: 'createdAt_desc',
    });
    return result.items;
  }

  async adminListPayments(
    actor: PaymentActor,
    raw: Record<string, unknown>,
  ): Promise<PaginatedResponse<PaymentDto>> {
    this.requireStaff(actor);
    const query = parseOrThrow(() => listPaymentsQuerySchema.parse(raw));
    return this.listPaymentsInternal(query);
  }

  async adminGetPayment(
    actor: PaymentActor,
    paymentId: string,
  ): Promise<PaymentDto> {
    this.requireStaff(actor);
    const payment = await this.requirePayment(paymentId);
    return toPaymentDto(payment);
  }

  async handleOrderCancelled(orderId: string): Promise<void> {
    const payments = await this.repository.findByOrderId(orderId);
    const systemActor: PaymentActor = {
      userId: 'system',
      roles: [Roles.Admin],
    };
    for (const payment of payments) {
      if (ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
        await this.transitionPayment(
          payment,
          'CANCELLED',
          systemActor,
          'ORDER_CANCELLED',
          'Đơn hàng đã bị hủy',
          undefined,
        );
      }
    }
  }

  async handleOrderDelivered(orderId: string): Promise<void> {
    const payments = await this.repository.findByOrderId(orderId);
    const codPayment = payments.find(
      (p) => p.provider === 'COD' && p.status === 'PENDING',
    );
    if (codPayment) {
      const systemActor: PaymentActor = {
        userId: 'system',
        roles: [Roles.Admin],
      };
      await this.markCodCollected(systemActor, codPayment.id);
    }
  }

  private async listPaymentsInternal(
    query: ListPaymentsQuery,
  ): Promise<PaginatedResponse<PaymentDto>> {
    const result = await this.repository.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      provider: query.provider,
      orderId: query.orderId,
      customerId: query.customerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      sort: query.sort,
    });
    return createPaginatedResponse(
      result.items.map(toPaymentDto),
      result.total,
      {
        page: result.page,
        pageSize: result.pageSize,
      },
    );
  }

  private async markPaid(
    payment: Payment,
    actor: PaymentActor,
    providerTxnId?: string,
    auditAction?: string,
  ): Promise<Payment> {
    if (payment.status === 'PAID') {
      return payment;
    }
    assertPaymentTransition(payment.status, 'PAID');
    const paidAt = new Date();
    const traceId = createTraceId();

    try {
      const updated = await this.repository.updateStatus({
        paymentId: payment.id,
        expectedVersion: payment.version,
        status: 'PAID',
        paidAt,
        attempt: {
          attemptNumber: payment.attempts.length + 1,
          status: 'SUCCEEDED',
          providerReference: providerTxnId,
        },
        transaction: {
          type: 'CHARGE',
          amount: payment.amount,
          currency: payment.currency,
          providerTxnId,
          status: 'SUCCEEDED',
        },
        outboxEvents: [
          buildOutboxEvent(
            { ...payment, status: 'PAID', paidAt },
            'PAID',
            traceId,
          ),
          {
            eventType: EventTypes.PAYMENT_SUCCEEDED,
            routingKey: routingKeyFor(EventTypes.PAYMENT_SUCCEEDED),
            traceId,
            payload: {
              paymentId: payment.id,
              paymentReference: payment.paymentReference,
              orderId: payment.orderId,
            },
          },
          ...(auditAction
            ? [
                {
                  eventType: EventTypes.AUDIT_RECORDED,
                  routingKey: routingKeyFor(EventTypes.AUDIT_RECORDED),
                  traceId,
                  payload: {
                    action: auditAction,
                    actorId: actorIdOf(actor),
                    actorRoles: actor.roles,
                    resourceType: 'payment',
                    resourceId: payment.id,
                    orderId: payment.orderId,
                  },
                },
              ]
            : []),
        ],
        actorId: actorIdOf(actor),
      });

      await this.syncOrderIfNeeded(updated, actor, traceId);
      await this.outbox.dispatchPending();
      return updated;
    } catch (error) {
      if (
        error instanceof AppError &&
        error.errorCode === ErrorCodes.PAYMENT_CONFLICT
      ) {
        const latest = await this.repository.findById(payment.id);
        if (latest?.status === 'PAID') {
          return latest;
        }
      }
      throw error;
    }
  }

  private async syncOrderIfNeeded(
    payment: Payment,
    actor: PaymentActor,
    traceId: string,
  ): Promise<void> {
    if (payment.orderSyncedAt) {
      return;
    }
    const confirmOrder =
      payment.provider === 'MOCK' || payment.provider === 'VNPAY';
    try {
      await this.orderClient.syncPayment(
        payment.orderId,
        {
          paymentStatus: 'PAID',
          paymentReference: payment.paymentReference,
          paidAt: payment.paidAt?.toISOString(),
          confirmOrder,
          idempotencyKey: `sync-${payment.id}-paid`,
        },
        this.clientHeaders(actor, traceId),
      );
      const latest = await this.repository.findById(payment.id);
      if (!latest) return;
      await this.repository.updateStatus({
        paymentId: payment.id,
        expectedVersion: latest.version,
        status: latest.status,
        orderSyncedAt: new Date(),
        outboxEvents: [],
        actorId: 'system',
      });
    } catch {
      // Retry-safe: orderSyncedAt remains unset
    }
  }

  private async transitionPayment(
    payment: Payment,
    to: PaymentStatus,
    actor: PaymentActor,
    failureCode?: string,
    failureMessage?: string,
    providerTxnId?: string,
  ): Promise<PaymentDto> {
    if (payment.status === to) {
      return toPaymentDto(payment);
    }
    assertPaymentTransition(payment.status, to);
    const traceId = createTraceId();

    const updated = await this.repository.updateStatus({
      paymentId: payment.id,
      expectedVersion: payment.version,
      status: to,
      failureCode,
      failureMessage,
      attempt:
        to === 'FAILED'
          ? {
              attemptNumber: payment.attempts.length + 1,
              status: 'FAILED',
              failureCode,
              failureMessage,
              providerReference: providerTxnId,
            }
          : undefined,
      outboxEvents: [buildOutboxEvent({ ...payment, status: to }, to, traceId)],
      actorId: actorIdOf(actor),
    });

    if (to === 'FAILED' || to === 'EXPIRED') {
      try {
        await this.orderClient.syncPayment(
          payment.orderId,
          {
            paymentStatus: 'FAILED',
            paymentReference: payment.paymentReference,
            idempotencyKey: `sync-${payment.id}-${to}`,
          },
          this.clientHeaders(actor, traceId),
        );
      } catch {
        // optional sync
      }
    }

    await this.outbox.dispatchPending();
    return toPaymentDto(updated);
  }

  private async maybeExpire(payment: Payment): Promise<void> {
    if (
      !payment.expiresAt ||
      !ACTIVE_PAYMENT_STATUSES.includes(payment.status)
    ) {
      return;
    }
    if (payment.expiresAt.getTime() > Date.now()) {
      return;
    }
    const systemActor: PaymentActor = {
      userId: 'system',
      roles: [Roles.Admin],
    };
    await this.transitionPayment(
      payment,
      'EXPIRED',
      systemActor,
      'EXPIRED',
      'Phiên thanh toán đã hết hạn',
      undefined,
    );
  }

  private async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        message: 'Không tìm thấy thanh toán',
      });
    }
    return payment;
  }

  private assertOwnership(actor: PaymentActor, payment: Payment): void {
    if (
      enforceResourceOwnership({
        resourceOwnerId: payment.customerId,
        actorId: actor.customerId ?? actor.userId,
        actorIsStaff: isStaff(actor.roles),
        staffAllowed: true,
      }) === 'deny'
    ) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_FORBIDDEN,
        message: 'Không có quyền truy cập thanh toán này',
      });
    }
  }

  private requireStaff(actor: PaymentActor): void {
    if (!hasMinimumRole(actor.roles, Roles.Staff)) {
      throw new AppError({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Cần quyền nhân viên',
      });
    }
  }

  private async withIdempotency<T>(
    key: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.repository.getIdempotency(key);
    if (existing) {
      if (existing.operation !== operation) {
        throw new AppError({
          errorCode: ErrorCodes.PAYMENT_IDEMPOTENCY_CONFLICT,
          message: 'Khóa idempotency đã dùng cho thao tác khác',
        });
      }
      return existing.response as T;
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const promise = fn()
      .then(async (result) => {
        await this.repository.saveIdempotency(key, operation, result);
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}
