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
  /** Lỗi thao tác (thêm/sửa/xóa) — không dùng cho màn hình "không tải được". */
  actionError: string | null;
  /** Lỗi tải giỏ (GET/ensure thất bại hoàn toàn). */
  loadError: string | null;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  refresh: () => Promise<void>;
  clearActionError: () => void;
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cartRef = useRef<CartDto | null>(null);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const ensureCart = useCallback(async (): Promise<CartDto> => {
    if (cartRef.current) {
      return cartRef.current;
    }
    try {
      const data = await bff.get<CartDto>(CART_PATH);
      setCart(data);
      setLoadError(null);
      return data;
    } catch {
      const created = await bff.post<CartDto>(CART_GUEST_PATH);
      setCart(created);
      setLoadError(null);
      return created;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      try {
        const data = await bff.get<CartDto>(CART_PATH);
        setCart(data);
      } catch {
        const created = await bff.post<CartDto>(CART_GUEST_PATH);
        setCart(created);
      }
    } catch (err) {
      setCart(null);
      setLoadError(getErrorMessage(err, 'Không tải được giỏ hàng'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearActionError = useCallback(() => setActionError(null), []);

  const addItem = useCallback(
    async (skuCode: string, quantity = 1) => {
      setMutating(true);
      setActionError(null);
      try {
        await ensureCart();
        const data = await bff.post<CartDto>(`${CART_PATH}/items`, {
          skuCode,
          quantity,
        });
        setCart(data);
      } catch (err) {
        setActionError(
          getErrorMessage(err, 'Không thể thêm sản phẩm vào giỏ hàng'),
        );
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [ensureCart],
  );

  const updateItem = useCallback(async (skuId: string, quantity: number) => {
    setMutating(true);
    setActionError(null);
    try {
      const data = await bff.patch<CartDto>(`${CART_PATH}/items/${skuId}`, {
        quantity,
      });
      setCart(data);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thể cập nhật số lượng'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const removeItem = useCallback(async (skuId: string) => {
    setMutating(true);
    setActionError(null);
    try {
      const data = await bff.delete<CartDto>(`${CART_PATH}/items/${skuId}`);
      setCart(data);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thể xóa sản phẩm'));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setMutating(true);
    setActionError(null);
    try {
      const data = await bff.delete<CartDto>(CART_PATH);
      setCart(data);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thể xóa giỏ hàng'));
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
      actionError,
      loadError,
      itemCount: totals.itemCount,
      totalQuantity: totals.totalQuantity,
      subtotal: totals.subtotal,
      refresh,
      clearActionError,
      addItem,
      updateItem,
      removeItem,
      clearCart,
    }),
    [
      cart,
      loading,
      mutating,
      actionError,
      loadError,
      totals,
      refresh,
      clearActionError,
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
