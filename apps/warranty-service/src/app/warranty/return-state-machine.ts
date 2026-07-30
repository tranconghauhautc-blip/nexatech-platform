import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  ReturnRequestStatus,
  ReturnRequestTransitionAction,
} from '@nexatech/shared-contracts';

const TRANSITIONS: Record<
  ReturnRequestStatus,
  Partial<Record<ReturnRequestTransitionAction, ReturnRequestStatus>>
> = {
  REQUESTED: {
    start_review: 'UNDER_REVIEW',
    cancel: 'CANCELLED',
  },
  UNDER_REVIEW: {
    approve: 'APPROVED',
    reject: 'REJECTED',
    cancel: 'CANCELLED',
  },
  APPROVED: {
    mark_awaiting_return: 'AWAITING_RETURN',
    cancel: 'CANCELLED',
  },
  AWAITING_RETURN: {
    mark_received: 'RECEIVED',
    cancel: 'CANCELLED',
  },
  RECEIVED: {
    complete: 'COMPLETED',
  },
  REJECTED: {},
  COMPLETED: {},
  CANCELLED: {},
};

export const RETURN_TERMINAL_STATUSES: readonly ReturnRequestStatus[] = [
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
];

export function isReturnTerminal(status: ReturnRequestStatus): boolean {
  return RETURN_TERMINAL_STATUSES.includes(status);
}

export function resolveReturnTransition(
  from: ReturnRequestStatus,
  action: ReturnRequestTransitionAction,
): ReturnRequestStatus {
  const target = TRANSITIONS[from]?.[action];
  if (!target) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu đổi trả',
      details: { from, action },
    });
  }
  return target;
}

export function canTransitionReturn(
  from: ReturnRequestStatus,
  action: ReturnRequestTransitionAction,
): boolean {
  return Boolean(TRANSITIONS[from]?.[action]);
}

export function assertReturnTransition(
  from: ReturnRequestStatus,
  to: ReturnRequestStatus,
): void {
  const allowedTargets = Object.values(TRANSITIONS[from] ?? {});
  if (!allowedTargets.includes(to)) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu đổi trả',
      details: { from, to },
    });
  }
}

/**
 * Xác định trạng thái đơn hàng cần đồng bộ theo trạng thái đổi trả mới.
 * Chỉ đồng bộ khi thực sự cần và khác với trạng thái đã đồng bộ trước đó.
 */
export function resolveOrderSyncTarget(
  toStatus: ReturnRequestStatus,
  currentOrderSyncedStatus?: string,
): 'RETURN_REQUESTED' | 'RETURNED' | 'DELIVERED' | undefined {
  if (toStatus === 'APPROVED') {
    return 'RETURN_REQUESTED';
  }
  if (toStatus === 'COMPLETED') {
    return 'RETURNED';
  }
  if (
    (toStatus === 'REJECTED' || toStatus === 'CANCELLED') &&
    currentOrderSyncedStatus === 'RETURN_REQUESTED'
  ) {
    return 'DELIVERED';
  }
  return undefined;
}
