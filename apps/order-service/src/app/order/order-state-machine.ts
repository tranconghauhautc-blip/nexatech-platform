import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { OrderStatus } from './order.types';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'FAILED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['READY_TO_SHIP', 'CANCELLED', 'FAILED'],
  READY_TO_SHIP: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  CANCELLED: [],
  RETURNED: [],
  FAILED: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'CANCELLED',
  'RETURNED',
  'FAILED',
];

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function getAllowedTransitions(
  from: OrderStatus,
): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return getAllowedTransitions(from).includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      errorCode: ErrorCodes.ORDER_INVALID_TRANSITION,
      message: `Không thể chuyển trạng thái đơn hàng từ ${from} sang ${to}`,
      details: { from, to },
    });
  }
}
