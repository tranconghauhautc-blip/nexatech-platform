import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { ReviewStatus } from '@nexatech/shared-contracts';

const ALLOWED: Record<ReviewStatus, ReviewStatus[]> = {
  PENDING: ['PUBLISHED', 'HIDDEN', 'REJECTED', 'DELETED'],
  PUBLISHED: ['HIDDEN', 'REJECTED', 'DELETED'],
  HIDDEN: ['PUBLISHED', 'PENDING', 'DELETED'],
  REJECTED: ['PUBLISHED', 'PENDING', 'DELETED'],
  DELETED: [],
};

export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: ReviewStatus, to: ReviewStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái đánh giá',
      details: { from, to },
    });
  }
}

export type ModerateAction = 'publish' | 'hide' | 'reject' | 'restore';

export function resolveModerateTarget(
  action: ModerateAction,
  current: ReviewStatus,
): ReviewStatus {
  switch (action) {
    case 'publish':
      return 'PUBLISHED';
    case 'hide':
      return 'HIDDEN';
    case 'reject':
      return 'REJECTED';
    case 'restore':
      if (current === 'HIDDEN' || current === 'REJECTED') {
        return 'PUBLISHED';
      }
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
        message: 'Chỉ khôi phục được đánh giá đang ẩn hoặc bị từ chối',
        details: { current, action },
      });
    default:
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Hành động kiểm duyệt không hợp lệ',
        details: { action },
      });
  }
}

export function initialReviewStatus(autoPublish: boolean): ReviewStatus {
  return autoPublish ? 'PUBLISHED' : 'PENDING';
}
