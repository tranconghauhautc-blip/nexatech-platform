import {
  clampCartQuantity,
  computeCartTotals,
  formatVariantAttributes,
  isCartEmpty,
} from '../../src/lib/cart-utils';
import type { CartDto, CartItemDto } from '@nexatech/shared-contracts';

function makeItem(overrides: Partial<CartItemDto> = {}): CartItemDto {
  return {
    id: 'item-1',
    skuId: 'sku-1',
    skuCode: 'SKU-1',
    quantity: 1,
    unitPriceSnapshot: 1000,
    priceChanged: false,
    currency: 'VND',
    productId: 'p-1',
    productName: 'Điện thoại NexaPhone',
    productSlug: 'nexaphone',
    skuName: 'NexaPhone 256GB Đen',
    attributes: { mau: 'Đen', dung_luong: '256GB' },
    available: true,
    lineSubtotal: 1000,
    ...overrides,
  };
}

describe('computeCartTotals', () => {
  it('sums quantity and subtotal across items', () => {
    const items = [
      makeItem({ quantity: 2, lineSubtotal: 2000 }),
      makeItem({ id: 'item-2', quantity: 1, lineSubtotal: 500 }),
    ];
    const totals = computeCartTotals(items);
    expect(totals.itemCount).toBe(2);
    expect(totals.totalQuantity).toBe(3);
    expect(totals.subtotal).toBe(2500);
    expect(totals.hasPriceChanges).toBe(false);
    expect(totals.hasUnavailableItems).toBe(false);
  });

  it('flags price changes and unavailable items', () => {
    const items = [
      makeItem({ priceChanged: true }),
      makeItem({ id: 'item-2', available: false }),
    ];
    const totals = computeCartTotals(items);
    expect(totals.hasPriceChanges).toBe(true);
    expect(totals.hasUnavailableItems).toBe(true);
  });

  it('returns zeros for an empty cart', () => {
    const totals = computeCartTotals([]);
    expect(totals).toEqual({
      itemCount: 0,
      totalQuantity: 0,
      subtotal: 0,
      hasPriceChanges: false,
      hasUnavailableItems: false,
    });
  });
});

describe('formatVariantAttributes', () => {
  it('joins attribute values with a middle dot', () => {
    expect(formatVariantAttributes({ mau: 'Đen', dung_luong: '256GB' })).toBe(
      'Đen · 256GB',
    );
  });

  it('returns empty string when attributes are undefined', () => {
    expect(formatVariantAttributes(undefined)).toBe('');
  });

  it('filters out falsy values', () => {
    expect(formatVariantAttributes({ mau: 'Đen', size: '' })).toBe('Đen');
  });
});

describe('isCartEmpty', () => {
  it('returns true for null/undefined cart', () => {
    expect(isCartEmpty(null)).toBe(true);
    expect(isCartEmpty(undefined)).toBe(true);
  });

  it('returns true when items array is empty', () => {
    const cart = { items: [] } as unknown as CartDto;
    expect(isCartEmpty(cart)).toBe(true);
  });

  it('returns false when cart has items', () => {
    const cart = { items: [makeItem()] } as unknown as CartDto;
    expect(isCartEmpty(cart)).toBe(false);
  });
});

describe('clampCartQuantity', () => {
  it('clamps to minimum of 1', () => {
    expect(clampCartQuantity(0)).toBe(1);
    expect(clampCartQuantity(-5)).toBe(1);
  });

  it('clamps to provided max', () => {
    expect(clampCartQuantity(150, 99)).toBe(99);
  });

  it('truncates decimals', () => {
    expect(clampCartQuantity(3.9)).toBe(3);
  });

  it('falls back to 1 for non-finite input', () => {
    expect(clampCartQuantity(Number.NaN)).toBe(1);
  });
});
