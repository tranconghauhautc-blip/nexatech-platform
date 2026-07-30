import { ErrorCodes } from '@nexatech/shared-errors';
import {
  assertClaimTransition,
  canTransitionClaim,
  isClaimTerminal,
  resolveClaimTransition,
} from './claim-state-machine';

describe('claim state machine', () => {
  it('allows expected transitions', () => {
    expect(canTransitionClaim('SUBMITTED', 'start_review')).toBe(true);
    expect(canTransitionClaim('UNDER_REVIEW', 'approve')).toBe(true);
    expect(canTransitionClaim('UNDER_REVIEW', 'reject')).toBe(true);
    expect(canTransitionClaim('APPROVED', 'start_repair')).toBe(true);
    expect(canTransitionClaim('IN_PROGRESS', 'complete')).toBe(true);
    expect(canTransitionClaim('SUBMITTED', 'cancel')).toBe(true);
    expect(canTransitionClaim('COMPLETED', 'cancel')).toBe(false);
  });

  it('resolves target status', () => {
    expect(resolveClaimTransition('SUBMITTED', 'start_review')).toBe(
      'UNDER_REVIEW',
    );
    expect(resolveClaimTransition('UNDER_REVIEW', 'approve')).toBe('APPROVED');
  });

  it('throws on invalid transition', () => {
    try {
      resolveClaimTransition('COMPLETED', 'cancel');
      fail('expected throw');
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      });
    }
  });

  it('assertClaimTransition validates from/to pair', () => {
    expect(() =>
      assertClaimTransition('SUBMITTED', 'UNDER_REVIEW'),
    ).not.toThrow();
    expect(() => assertClaimTransition('SUBMITTED', 'COMPLETED')).toThrow();
  });

  it('identifies terminal statuses', () => {
    expect(isClaimTerminal('COMPLETED')).toBe(true);
    expect(isClaimTerminal('REJECTED')).toBe(true);
    expect(isClaimTerminal('CANCELLED')).toBe(true);
    expect(isClaimTerminal('SUBMITTED')).toBe(false);
    expect(isClaimTerminal('UNDER_REVIEW')).toBe(false);
  });
});
