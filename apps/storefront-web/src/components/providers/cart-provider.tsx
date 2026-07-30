'use client';

import type { CartDto } from '@nexatech/shared-contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { computeCartTotals } from '../../lib/cart-utils';

interface CartContextValue {
  cart: CartDto | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  refresh: () => Promise<void>;
  addItem: (skuCode: string, quantity?: number) => Promise<void>;
  updateItem: (skuId: string, quantity: number) => Promise<void>;
  removeItem: (skuId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_PATH = '/api/bff/cart/carts/current';
const CART_GUEST_PATH = '/api/bff/cart/carts/guest';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartRef = useRef<CartDto | null>(null);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bff.get<CartDto>(CART_PATH);
      setCart(data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ensureCart = useCallback(async (): Promise<CartDto> => {
    if (cartRef.current) {
      return cartRef.current;
    }
    try {
      const data = await bff.get<CartDto>(CART_PATH);
      setCart(data);
      return data;
    } catch {
      const created = await bff.post<CartDto>(CART_GUEST_PATH);
      setCart(created);
      return created;
    }
  }, []);

  const addItem = useCallback(
    async (skuCode: string, quantity = 1) => {
      setMutating(true);
      setError(null);
      try {
        await ensureCart();
        const data = await bff.post<CartDto>(`${CART_PATH}/items`, {
          skuCode,
          quantity,
        });
        setCart(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Không thể thêm sản phẩm vào giỏ hàng'));
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [ensureCart],
  );

  const updateItem = useCallback(async (skuId: string, quantity: number) => {
    setMutating(true);
    setError(null);
    try {
      const data = await bff.patch<CartDto>(`${CART_PATH}/items/${skuId}`, {
        quantity,
      });
      setCart(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể cập nhật số lượng'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const removeItem = useCallback(async (skuId: string) => {
    setMutating(true);
    setError(null);
    try {
      const data = await bff.delete<CartDto>(`${CART_PATH}/items/${skuId}`);
      setCart(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể xóa sản phẩm'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setMutating(true);
    setError(null);
    try {
      const data = await bff.delete<CartDto>(CART_PATH);
      setCart(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể xóa giỏ hàng'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const totals = useMemo(() => computeCartTotals(cart?.items ?? []), [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      mutating,
      error,
      itemCount: totals.itemCount,
      totalQuantity: totals.totalQuantity,
      subtotal: totals.subtotal,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearCart,
    }),
    [
      cart,
      loading,
      mutating,
      error,
      totals,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart phải được dùng bên trong <CartProvider>');
  }
  return ctx;
}
