import type { CartDto, CartItemDto } from '@nexatech/shared-contracts';

export interface CartTotals {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  hasPriceChanges: boolean;
  hasUnavailableItems: boolean;
}

/** Tính lại tổng giỏ hàng phía client (dùng để hiển thị lạc quan trước khi server phản hồi). */
export function computeCartTotals(items: CartItemDto[]): CartTotals {
  let totalQuantity = 0;
  let subtotal = 0;
  let hasPriceChanges = false;
  let hasUnavailableItems = false;

  for (const item of items) {
    totalQuantity += item.quantity;
    subtotal += item.lineSubtotal;
    if (item.priceChanged) {
      hasPriceChanges = true;
    }
    if (item.available === false) {
      hasUnavailableItems = true;
    }
  }

  return {
    itemCount: items.length,
    totalQuantity,
    subtotal,
    hasPriceChanges,
    hasUnavailableItems,
  };
}

/** Định dạng thuộc tính biến thể (VD: `{ mau: "Đen", dung_luong: "256GB" }` → "Đen · 256GB"). */
export function formatVariantAttributes(
  attributes: Record<string, string> | undefined,
): string {
  if (!attributes) {
    return '';
  }
  return Object.values(attributes).filter(Boolean).join(' · ');
}

export function isCartEmpty(cart: CartDto | null | undefined): boolean {
  return !cart || cart.items.length === 0;
}

/** Giới hạn số lượng theo CART_ITEM_MAX_QUANTITY, không cho nhỏ hơn 1. */
export function clampCartQuantity(value: number, max = 99): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
