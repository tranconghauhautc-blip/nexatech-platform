import { ErrorCodes } from '@nexatech/shared-errors';
import type { SupportTicketStatus } from '@nexatech/shared-contracts';
import {
  canTransitionTicket,
  isTicketTerminal,
  resolveCustomerMessageTransition,
  resolveTicketTransition,
  TICKET_TERMINAL_STATUSES,
} from './ticket-state-machine';

describe('ticket-state-machine', () => {
  it('transitions OPEN -> IN_PROGRESS via start', () => {
    expect(resolveTicketTransition('OPEN', 'start')).toBe('IN_PROGRESS');
  });

  it('transitions OPEN -> CANCELLED via cancel', () => {
    expect(resolveTicketTransition('OPEN', 'cancel')).toBe('CANCELLED');
  });

  it('transitions IN_PROGRESS to WAITING_CUSTOMER, RESOLVED, CLOSED or CANCELLED', () => {
    expect(resolveTicketTransition('IN_PROGRESS', 'wait_customer')).toBe(
      'WAITING_CUSTOMER',
    );
    expect(resolveTicketTransition('IN_PROGRESS', 'resolve')).toBe('RESOLVED');
    expect(resolveTicketTransition('IN_PROGRESS', 'close')).toBe('CLOSED');
    expect(resolveTicketTransition('IN_PROGRESS', 'cancel')).toBe('CANCELLED');
  });

  it('only allows cancel as a manual action from WAITING_CUSTOMER', () => {
    expect(resolveTicketTransition('WAITING_CUSTOMER', 'cancel')).toBe(
      'CANCELLED',
    );
    expect(canTransitionTicket('WAITING_CUSTOMER', 'start')).toBe(false);
    expect(canTransitionTicket('WAITING_CUSTOMER', 'resolve')).toBe(false);
    expect(canTransitionTicket('WAITING_CUSTOMER', 'close')).toBe(false);
  });

  it('transitions WAITING_STAFF to IN_PROGRESS, RESOLVED, CLOSED or CANCELLED', () => {
    expect(resolveTicketTransition('WAITING_STAFF', 'start')).toBe(
      'IN_PROGRESS',
    );
    expect(resolveTicketTransition('WAITING_STAFF', 'resolve')).toBe(
      'RESOLVED',
    );
    expect(resolveTicketTransition('WAITING_STAFF', 'close')).toBe('CLOSED');
    expect(resolveTicketTransition('WAITING_STAFF', 'cancel')).toBe(
      'CANCELLED',
    );
  });

  it('transitions RESOLVED to CLOSED or back to IN_PROGRESS via reopen, but not cancel', () => {
    expect(resolveTicketTransition('RESOLVED', 'close')).toBe('CLOSED');
    expect(resolveTicketTransition('RESOLVED', 'reopen')).toBe('IN_PROGRESS');
    expect(canTransitionTicket('RESOLVED', 'cancel')).toBe(false);
  });

  it('automatically transitions WAITING_CUSTOMER -> WAITING_STAFF on customer reply', () => {
    expect(resolveCustomerMessageTransition('WAITING_CUSTOMER')).toBe(
      'WAITING_STAFF',
    );
    expect(resolveCustomerMessageTransition('OPEN')).toBeUndefined();
    expect(resolveCustomerMessageTransition('IN_PROGRESS')).toBeUndefined();
    expect(resolveCustomerMessageTransition('WAITING_STAFF')).toBeUndefined();
  });

  it('rejects invalid transitions with SUPPORT_INVALID_TRANSITION', () => {
    expect(() => resolveTicketTransition('OPEN', 'resolve')).toThrow();
    try {
      resolveTicketTransition('OPEN', 'resolve');
      fail('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
      });
    }
  });

  it('marks CLOSED and CANCELLED as terminal with no further transitions', () => {
    const terminals: SupportTicketStatus[] = ['CLOSED', 'CANCELLED'];
    for (const status of terminals) {
      expect(isTicketTerminal(status)).toBe(true);
      expect(canTransitionTicket(status, 'start')).toBe(false);
      expect(canTransitionTicket(status, 'cancel')).toBe(false);
      expect(canTransitionTicket(status, 'resolve')).toBe(false);
      expect(canTransitionTicket(status, 'close')).toBe(false);
      expect(canTransitionTicket(status, 'reopen')).toBe(false);
      expect(canTransitionTicket(status, 'wait_customer')).toBe(false);
    }
    expect(TICKET_TERMINAL_STATUSES).toEqual(['CLOSED', 'CANCELLED']);
  });

  it('marks non-terminal statuses correctly', () => {
    const nonTerminals: SupportTicketStatus[] = [
      'OPEN',
      'IN_PROGRESS',
      'WAITING_CUSTOMER',
      'WAITING_STAFF',
      'RESOLVED',
    ];
    for (const status of nonTerminals) {
      expect(isTicketTerminal(status)).toBe(false);
    }
  });
});
