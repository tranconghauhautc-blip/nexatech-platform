import type {
  PaymentLifecycleStatus,
  PaymentMethod,
  PaymentProviderCode,
  RefundStatus,
} from '@nexatech/shared-contracts';

export type PaymentStatus = PaymentLifecycleStatus;

export type PaymentProvider = PaymentProviderCode;

export type AttemptStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type TransactionType = 'CHARGE' | 'REFUND' | 'ADJUSTMENT';

export type CallbackStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

export type { RefundStatus };

export const ACTIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'CREATED',
  'PENDING',
  'PROCESSING',
];

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  providerReference?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt: Date;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  providerTxnId?: string;
  status: string;
  createdAt: Date;
}

export interface PaymentCallback {
  id: string;
  paymentId: string;
  provider: PaymentProvider;
  payloadHash: string;
  signatureValid: boolean;
  rawPayloadJson: Record<string, unknown>;
  providerTxnId?: string;
  processed: boolean;
  resultStatus: CallbackStatus;
  createdAt: Date;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  refundReference: string;
  providerRefundId?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  paymentReference: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  amountRefunded: number;
  checkoutUrl?: string;
  expiresAt?: Date;
  paidAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  version: number;
  orderSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  attempts: PaymentAttempt[];
  transactions: PaymentTransaction[];
  refunds: Refund[];
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

export interface CreatePaymentInput {
  id: string;
  paymentReference: string;
  orderId: string;
  orderCode: string;
  customerId: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  checkoutUrl?: string;
  expiresAt?: Date;
  attempt: {
    attemptNumber: number;
    status: AttemptStatus;
    providerReference?: string;
  };
  outboxEvents: OutboxEventInput[];
  actorId: string;
}

export interface UpdatePaymentStatusInput {
  paymentId: string;
  expectedVersion: number;
  status: PaymentStatus;
  paidAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  checkoutUrl?: string;
  orderSyncedAt?: Date;
  transaction?: {
    type: TransactionType;
    amount: number;
    currency: string;
    providerTxnId?: string;
    status: string;
  };
  attempt?: {
    attemptNumber: number;
    status: AttemptStatus;
    providerReference?: string;
    failureCode?: string;
    failureMessage?: string;
  };
  outboxEvents: OutboxEventInput[];
  actorId: string;
}

export interface CreateCallbackInput {
  paymentId: string;
  provider: PaymentProvider;
  payloadHash: string;
  signatureValid: boolean;
  rawPayloadJson: Record<string, unknown>;
  providerTxnId?: string;
  processed: boolean;
  resultStatus: CallbackStatus;
}

export interface CreateRefundInput {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  refundReference: string;
  providerRefundId?: string;
  idempotencyKey?: string;
  paymentExpectedVersion: number;
  newPaymentStatus: PaymentStatus;
  newAmountRefunded: number;
  outboxEvents: OutboxEventInput[];
  actorId: string;
}

export interface ListPaymentsFilter {
  page: number;
  pageSize: number;
  status?: PaymentStatus;
  provider?: PaymentProvider;
  orderId?: string;
  customerId?: string;
  from?: Date;
  to?: Date;
  sort: string;
}

export interface ListPaymentsResult {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderSnapshot {
  id: string;
  orderCode: string;
  customerId: string;
  status: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  grandTotal: number;
  currency: string;
}

export interface SyncPaymentInput {
  paymentStatus:
    | 'UNPAID'
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
    | 'REFUNDED'
    | 'REFUND_PENDING';
  paymentReference?: string;
  paidAt?: string;
  confirmOrder?: boolean;
  idempotencyKey?: string;
}

export interface OrderClientHeaders {
  userId?: string;
  roles?: string[];
  traceId?: string;
}
