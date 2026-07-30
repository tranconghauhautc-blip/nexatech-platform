import { AppError } from '@nexatech/shared-errors';
import {
  addVnd,
  assertRefundAmount,
  subtractVnd,
  vndToVnpayAmount,
  vnpayAmountToVnd,
} from './money';

describe('money', () => {
  it('converts VND to VNPay amount (×100)', () => {
    expect(vndToVnpayAmount(100_000)).toBe(10_000_000);
  });

  it('converts VNPay amount back to VND', () => {
    expect(vnpayAmountToVnd(10_000_000)).toBe(100_000);
  });

  it('rejects non-integer VND', () => {
    expect(() => vndToVnpayAmount(1.5)).toThrow(AppError);
  });

  it('rejects VNPay amount not divisible by 100', () => {
    expect(() => vnpayAmountToVnd(100001)).toThrow(AppError);
  });

  it('addVnd detects overflow', () => {
    expect(() => addVnd(Number.MAX_SAFE_INTEGER, 1)).toThrow(AppError);
  });

  it('subtractVnd rejects negative result', () => {
    expect(() => subtractVnd(100, 200)).toThrow(AppError);
  });

  it('assertRefundAmount validates remaining balance', () => {
    expect(() => assertRefundAmount(1_000_000, 0, 500_000)).not.toThrow();
    expect(() => assertRefundAmount(1_000_000, 800_000, 300_000)).toThrow(
      AppError,
    );
  });
});
