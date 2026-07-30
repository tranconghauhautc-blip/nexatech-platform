import {
  assertTransition,
  canTransition,
  initialReviewStatus,
  resolveModerateTarget,
} from './review-state-machine';
import { ErrorCodes } from '@nexatech/shared-errors';

describe('review state machine', () => {
  it('allows expected transitions', () => {
    expect(canTransition('PENDING', 'PUBLISHED')).toBe(true);
    expect(canTransition('PUBLISHED', 'HIDDEN')).toBe(true);
    expect(canTransition('HIDDEN', 'PUBLISHED')).toBe(true);
    expect(canTransition('DELETED', 'PUBLISHED')).toBe(false);
  });

  it('throws on invalid transition', () => {
    try {
      assertTransition('DELETED', 'PUBLISHED');
      fail('expected throw');
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: ErrorCodes.REVIEW_INVALID_TRANSITION,
      });
    }
  });

  it('resolves moderate actions', () => {
    expect(resolveModerateTarget('publish', 'PENDING')).toBe('PUBLISHED');
    expect(resolveModerateTarget('hide', 'PUBLISHED')).toBe('HIDDEN');
    expect(resolveModerateTarget('reject', 'PENDING')).toBe('REJECTED');
    expect(resolveModerateTarget('restore', 'HIDDEN')).toBe('PUBLISHED');
  });

  it('maps auto-publish flag', () => {
    expect(initialReviewStatus(true)).toBe('PUBLISHED');
    expect(initialReviewStatus(false)).toBe('PENDING');
  });
});
