import { formatVnd } from '@nexatech/shared-web';
import { clampCartQuantity, computeCartTotals } from '../../src/lib/cart-utils';
import { loginFormSchema } from '../../src/lib/validation';

describe('storefront utils', () => {
  it('formats VND', () => {
    expect(formatVnd(1000)).toMatch(/1\.000/);
  });

  it('clamps cart quantity', () => {
    expect(clampCartQuantity(0)).toBe(1);
    expect(clampCartQuantity(200)).toBe(99);
  });

  it('computes cart totals', () => {
    const totals = computeCartTotals([
      {
        id: '1',
        skuId: 's1',
        skuCode: 'SKU',
        quantity: 2,
        unitPriceSnapshot: 1000,
        priceChanged: false,
        currency: 'VND',
        productId: 'p',
        productName: 'P',
        productSlug: 'p',
        skuName: 'S',
        attributes: {},
        lineSubtotal: 2000,
      },
    ]);
    expect(totals.subtotal).toBe(2000);
    expect(totals.itemCount).toBe(1);
  });

  it('validates login form', () => {
    expect(
      loginFormSchema.safeParse({ email: 'a@nexatech.vn', password: 'x' })
        .success,
    ).toBe(true);
    expect(
      loginFormSchema.safeParse({ email: 'bad', password: '' }).success,
    ).toBe(false);
  });
});
