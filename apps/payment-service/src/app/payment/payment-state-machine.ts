import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { PaymentStatus } from './payment.types';

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['PENDING', 'PROCESSING', 'CANCELLED', 'EXPIRED', 'FAILED'],
  PENDING: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PROCESSING: ['PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PAID: ['REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUND_PENDING: ['REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
  REFUNDED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
];

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return (
    TERMINAL_PAYMENT_STATUSES.includes(status) ||
    status === 'PARTIALLY_REFUNDED'
  );
}

export function getAllowedPaymentTransitions(
  from: PaymentStatus,
): readonly PaymentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return getAllowedPaymentTransitions(from).includes(to);
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): void {
  if (!canPaymentTransition(from, to)) {
    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_INVALID_TRANSITION,
      message: `Không thể chuyển trạng thái thanh toán từ ${from} sang ${to}`,
      details: { from, to },
    });
  }
}
