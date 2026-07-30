import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  WarrantyClaimStatus,
  WarrantyClaimTransitionAction,
} from '@nexatech/shared-contracts';

const TRANSITIONS: Record<
  WarrantyClaimStatus,
  Partial<Record<WarrantyClaimTransitionAction, WarrantyClaimStatus>>
> = {
  SUBMITTED: {
    start_review: 'UNDER_REVIEW',
    cancel: 'CANCELLED',
  },
  UNDER_REVIEW: {
    approve: 'APPROVED',
    reject: 'REJECTED',
    cancel: 'CANCELLED',
  },
  APPROVED: {
    start_repair: 'IN_PROGRESS',
    cancel: 'CANCELLED',
  },
  IN_PROGRESS: {
    complete: 'COMPLETED',
    cancel: 'CANCELLED',
  },
  REJECTED: {},
  COMPLETED: {},
  CANCELLED: {},
};

export const CLAIM_TERMINAL_STATUSES: readonly WarrantyClaimStatus[] = [
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
];

export function isClaimTerminal(status: WarrantyClaimStatus): boolean {
  return CLAIM_TERMINAL_STATUSES.includes(status);
}

export function resolveClaimTransition(
  from: WarrantyClaimStatus,
  action: WarrantyClaimTransitionAction,
): WarrantyClaimStatus {
  const target = TRANSITIONS[from]?.[action];
  if (!target) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu bảo hành',
      details: { from, action },
    });
  }
  return target;
}

export function canTransitionClaim(
  from: WarrantyClaimStatus,
  action: WarrantyClaimTransitionAction,
): boolean {
  return Boolean(TRANSITIONS[from]?.[action]);
}

export function assertClaimTransition(
  from: WarrantyClaimStatus,
  to: WarrantyClaimStatus,
): void {
  const allowedTargets = Object.values(TRANSITIONS[from] ?? {});
  if (!allowedTargets.includes(to)) {
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu bảo hành',
      details: { from, to },
    });
  }
}
