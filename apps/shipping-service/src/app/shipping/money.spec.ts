import { addVnd, assertVndInt } from './money';
import { AppError } from '@nexatech/shared-errors';
import { computeMockPackageFee } from './providers/mock.provider';

describe('shipping money', () => {
  it('keeps VND as integers', () => {
    expect(addVnd(30_000, 50_000)).toBe(80_000);
    expect(() => assertVndInt(30_000.5)).toThrow(AppError);
  });

  it('computes deterministic mock package fees as int', () => {
    const a = computeMockPackageFee('STANDARD', 'pkg-1');
    const b = computeMockPackageFee('STANDARD', 'pkg-1');
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(computeMockPackageFee('STORE_PICKUP', 'pkg-1')).toBe(0);
  });
});
