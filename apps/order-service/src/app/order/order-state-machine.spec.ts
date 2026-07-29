import { ErrorCodes } from '@nexatech/shared-errors';
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
  isTerminalStatus,
} from './order-state-machine';

describe('order state machine', () => {
  it('allows the documented happy-path transitions', () => {
    expect(canTransition('PENDING', 'AWAITING_PAYMENT')).toBe(true);
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'READY_TO_SHIP')).toBe(true);
    expect(canTransition('READY_TO_SHIP', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
    expect(canTransition('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
    expect(canTransition('RETURN_REQUESTED', 'RETURNED')).toBe(true);
    expect(canTransition('RETURN_REQUESTED', 'DELIVERED')).toBe(true);
  });

  it('allows cancellation from every cancellable status', () => {
    for (const from of [
      'PENDING',
      'AWAITING_PAYMENT',
      'CONFIRMED',
      'PROCESSING',
      'READY_TO_SHIP',
    ] as const) {
      expect(canTransition(from, 'CANCELLED')).toBe(true);
    }
  });

  it('allows FAILED from early and mid fulfilment when compensation is needed', () => {
    expect(canTransition('PENDING', 'FAILED')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'FAILED')).toBe(true);
    expect(canTransition('CONFIRMED', 'FAILED')).toBe(true);
    expect(canTransition('PROCESSING', 'FAILED')).toBe(true);
    expect(canTransition('SHIPPED', 'FAILED')).toBe(false);
  });

  it('rejects invalid or backward transitions', () => {
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransition('CONFIRMED', 'PENDING')).toBe(false);
    expect(canTransition('PROCESSING', 'DELIVERED')).toBe(false);
  });

  it('treats CANCELLED, RETURNED and FAILED as terminal with no outgoing transitions', () => {
    for (const status of ['CANCELLED', 'RETURNED', 'FAILED'] as const) {
      expect(isTerminalStatus(status)).toBe(true);
      expect(getAllowedTransitions(status)).toEqual([]);
      expect(canTransition(status, 'CANCELLED')).toBe(false);
    }
  });

  it('assertTransition throws ORDER_INVALID_TRANSITION for illegal moves', () => {
    expect(() => assertTransition('SHIPPED', 'PENDING')).toThrow();
    try {
      assertTransition('SHIPPED', 'PENDING');
      fail('expected to throw');
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: ErrorCodes.ORDER_INVALID_TRANSITION,
      });
    }
  });

  it('assertTransition does not throw for legal moves', () => {
    expect(() => assertTransition('PENDING', 'CONFIRMED')).not.toThrow();
  });
});
