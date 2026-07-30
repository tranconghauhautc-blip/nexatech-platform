import { ErrorCodes } from '@nexatech/shared-errors';
import {
  assertReturnTransition,
  canTransitionReturn,
  isReturnTerminal,
  resolveOrderSyncTarget,
  resolveReturnTransition,
} from './return-state-machine';

describe('return state machine', () => {
  it('allows expected transitions', () => {
    expect(canTransitionReturn('REQUESTED', 'start_review')).toBe(true);
    expect(canTransitionReturn('UNDER_REVIEW', 'approve')).toBe(true);
    expect(canTransitionReturn('UNDER_REVIEW', 'reject')).toBe(true);
    expect(canTransitionReturn('APPROVED', 'mark_awaiting_return')).toBe(true);
    expect(canTransitionReturn('AWAITING_RETURN', 'mark_received')).toBe(true);
    expect(canTransitionReturn('RECEIVED', 'complete')).toBe(true);
    expect(canTransitionReturn('REQUESTED', 'cancel')).toBe(true);
    expect(canTransitionReturn('COMPLETED', 'cancel')).toBe(false);
  });

  it('resolves target status', () => {
    expect(resolveReturnTransition('REQUESTED', 'start_review')).toBe(
      'UNDER_REVIEW',
    );
    expect(resolveReturnTransition('UNDER_REVIEW', 'approve')).toBe('APPROVED');
  });

  it('throws on invalid transition', () => {
    try {
      resolveReturnTransition('COMPLETED', 'cancel');
      fail('expected throw');
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      });
    }
  });

  it('assertReturnTransition validates from/to pair', () => {
    expect(() =>
      assertReturnTransition('REQUESTED', 'UNDER_REVIEW'),
    ).not.toThrow();
    expect(() => assertReturnTransition('REQUESTED', 'COMPLETED')).toThrow();
  });

  it('identifies terminal statuses', () => {
    expect(isReturnTerminal('COMPLETED')).toBe(true);
    expect(isReturnTerminal('REJECTED')).toBe(true);
    expect(isReturnTerminal('CANCELLED')).toBe(true);
    expect(isReturnTerminal('REQUESTED')).toBe(false);
  });

  describe('resolveOrderSyncTarget', () => {
    it('syncs RETURN_REQUESTED when approved', () => {
      expect(resolveOrderSyncTarget('APPROVED', undefined)).toBe(
        'RETURN_REQUESTED',
      );
    });

    it('syncs RETURNED when completed', () => {
      expect(resolveOrderSyncTarget('COMPLETED', 'RETURN_REQUESTED')).toBe(
        'RETURNED',
      );
    });

    it('reverts to DELIVERED on reject after previous sync', () => {
      expect(resolveOrderSyncTarget('REJECTED', 'RETURN_REQUESTED')).toBe(
        'DELIVERED',
      );
      expect(resolveOrderSyncTarget('CANCELLED', 'RETURN_REQUESTED')).toBe(
        'DELIVERED',
      );
    });

    it('skips sync when not previously synced', () => {
      expect(resolveOrderSyncTarget('REJECTED', undefined)).toBeUndefined();
      expect(resolveOrderSyncTarget('CANCELLED', undefined)).toBeUndefined();
    });

    it('has no sync target for intermediate statuses', () => {
      expect(
        resolveOrderSyncTarget('AWAITING_RETURN', 'RETURN_REQUESTED'),
      ).toBeUndefined();
      expect(
        resolveOrderSyncTarget('RECEIVED', 'RETURN_REQUESTED'),
      ).toBeUndefined();
    });
  });
});
