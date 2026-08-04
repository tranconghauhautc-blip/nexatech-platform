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

/**
 * Trạng thái kiện hàng được coi là "đủ điều kiện" để đơn chuyển sang SHIPPED
 * bằng thao tác staff thủ công (status-transitions) — kiện phải tối thiểu đã
 * READY_TO_SHIP (đã đóng gói/chờ giao), không còn ở ALLOCATED/PENDING.
 */
export const PACKAGE_READY_FOR_ORDER_SHIPPED: readonly string[] = [
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
];
