import {
  assertPaymentTransition,
  canPaymentTransition,
  getAllowedPaymentTransitions,
} from './payment-state-machine';

describe('payment-state-machine', () => {
  it('allows CREATED -> PENDING', () => {
    expect(canPaymentTransition('CREATED', 'PENDING')).toBe(true);
  });

  it('allows PENDING -> PAID', () => {
    expect(canPaymentTransition('PENDING', 'PAID')).toBe(true);
  });

  it('allows PAID -> PARTIALLY_REFUNDED -> REFUNDED', () => {
    expect(canPaymentTransition('PAID', 'PARTIALLY_REFUNDED')).toBe(true);
    expect(canPaymentTransition('PARTIALLY_REFUNDED', 'REFUNDED')).toBe(true);
  });

  it('blocks PAID -> PENDING', () => {
    expect(canPaymentTransition('PAID', 'PENDING')).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => assertPaymentTransition('REFUNDED', 'PAID')).toThrow(
      /Không thể chuyển trạng thái/,
    );
  });

  it('lists allowed transitions from PROCESSING', () => {
    expect(getAllowedPaymentTransitions('PROCESSING')).toEqual([
      'PAID',
      'FAILED',
      'CANCELLED',
      'EXPIRED',
    ]);
  });
});
