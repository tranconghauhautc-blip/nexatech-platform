import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  SupportTicketStatus,
  SupportTicketTransitionAction,
} from '@nexatech/shared-contracts';

const TRANSITIONS: Record<
  SupportTicketStatus,
  Partial<Record<SupportTicketTransitionAction, SupportTicketStatus>>
> = {
  OPEN: {
    start: 'IN_PROGRESS',
    cancel: 'CANCELLED',
  },
  IN_PROGRESS: {
    wait_customer: 'WAITING_CUSTOMER',
    resolve: 'RESOLVED',
    close: 'CLOSED',
    cancel: 'CANCELLED',
  },
  WAITING_CUSTOMER: {
    cancel: 'CANCELLED',
  },
  WAITING_STAFF: {
    start: 'IN_PROGRESS',
    resolve: 'RESOLVED',
    close: 'CLOSED',
    cancel: 'CANCELLED',
  },
  RESOLVED: {
    close: 'CLOSED',
    reopen: 'IN_PROGRESS',
  },
  CLOSED: {},
  CANCELLED: {},
};

export const TICKET_TERMINAL_STATUSES: readonly SupportTicketStatus[] = [
  'CLOSED',
  'CANCELLED',
];

export function isTicketTerminal(status: SupportTicketStatus): boolean {
  return TICKET_TERMINAL_STATUSES.includes(status);
}

export function resolveTicketTransition(
  from: SupportTicketStatus,
  action: SupportTicketTransitionAction,
): SupportTicketStatus {
  const target = TRANSITIONS[from]?.[action];
  if (!target) {
    throw new AppError({
      errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu hỗ trợ',
      details: { from, action },
    });
  }
  return target;
}

export function canTransitionTicket(
  from: SupportTicketStatus,
  action: SupportTicketTransitionAction,
): boolean {
  return Boolean(TRANSITIONS[from]?.[action]);
}

export function assertTicketTransition(
  from: SupportTicketStatus,
  to: SupportTicketStatus,
): void {
  const allowedTargets = Object.values(TRANSITIONS[from] ?? {});
  if (!allowedTargets.includes(to)) {
    throw new AppError({
      errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
      message: 'Không thể chuyển trạng thái yêu cầu hỗ trợ',
      details: { from, to },
    });
  }
}

/**
 * Khi khách hàng gửi tin nhắn mới trong lúc ticket đang WAITING_CUSTOMER,
 * ticket tự động chuyển sang WAITING_STAFF để nhân viên tiếp tục xử lý.
 * Đây không phải là một action thủ công trong `supportTicketTransitionActionSchema`.
 */
export function resolveCustomerMessageTransition(
  from: SupportTicketStatus,
): SupportTicketStatus | undefined {
  if (from === 'WAITING_CUSTOMER') {
    return 'WAITING_STAFF';
  }
  return undefined;
}
