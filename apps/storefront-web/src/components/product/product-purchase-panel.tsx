'use client';

import { formatVnd } from '@nexatech/shared-web';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import {
  clampCartQuantity,
  formatVariantAttributes,
} from '../../lib/cart-utils';
import type { ProductDetail, StockSource } from '../../lib/types';
import { useAuth } from '../providers/auth-provider';
import { useCart } from '../providers/cart-provider';
import styles from './product-purchase-panel.module.css';

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const skus = product.skus ?? [];
  const [selectedSkuId, setSelectedSkuId] = useState(skus[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [stockSources, setStockSources] = useState<StockSource[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [wishlistState, setWishlistState] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');

  const { addItem, mutating } = useCart();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const selectedSku = useMemo(
    () => skus.find((sku) => sku.id === selectedSkuId) ?? skus[0],
    [skus, selectedSkuId],
  );

  useEffect(() => {
    if (!selectedSku) {
      return;
    }
    let cancelled = false;
    setStockLoading(true);
    bff
      .get<StockSource[]>('/api/bff/inventory/stock/availability', {
        skuCode: selectedSku.skuCode,
        quantity: 1,
      })
      .then((sources) => {
        if (!cancelled) {
          setStockSources(sources);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStockSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStockLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSku]);

  if (!selectedSku) {
    return (
      <div className="nt-form-error">
        Sản phẩm hiện chưa có phiên bản (SKU) để đặt mua.
      </div>
    );
  }

  const totalAvailable = stockSources.reduce((sum, s) => sum + s.available, 0);
  const inStock = totalAvailable > 0;

  async function requireLoginOrContinue(): Promise<boolean> {
    if (isAuthenticated) {
      return true;
    }
    router.push(`/dang-nhap?next=${encodeURIComponent(`/san-pham/${product.slug}`)}`);
    return false;
  }

  async function handleAddToCart() {
    setFeedback(null);
    if (!(await requireLoginOrContinue())) {
      return false;
    }
    try {
      await addItem(selectedSku!.skuCode, quantity);
      setFeedback({
        type: 'success',
        message: 'Đã thêm sản phẩm vào giỏ hàng.',
      });
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      if (/cart token|đăng nhập|UNAUTHORIZED/i.test(message)) {
        router.push(
          `/dang-nhap?next=${encodeURIComponent(`/san-pham/${product.slug}`)}`,
        );
        return false;
      }
      setFeedback({ type: 'error', message });
      return false;
    }
  }

  async function handleBuyNow() {
    setFeedback(null);
    if (!(await requireLoginOrContinue())) {
      return;
    }
    try {
      await addItem(selectedSku!.skuCode, quantity);
      router.push('/thanh-toan');
    } catch (error) {
      const message = getErrorMessage(error);
      if (/cart token|đăng nhập|UNAUTHORIZED/i.test(message)) {
        router.push(
          `/dang-nhap?next=${encodeURIComponent(`/san-pham/${product.slug}`)}`,
        );
        return;
      }
      setFeedback({ type: 'error', message });
    }
  }

  async function handleAddWishlist() {
    if (!isAuthenticated) {
      router.push('/dang-nhap?next=/san-pham/' + product.slug);
      return;
    }
    setWishlistState('saving');
    try {
      await bff.post('/api/bff/cart/wishlist', { productId: product.id });
      setWishlistState('saved');
    } catch {
      setWishlistState('idle');
    }
  }

  async function handleAddCompare() {
    if (!isAuthenticated) {
      router.push('/dang-nhap?next=/san-pham/' + product.slug);
      return;
    }
    try {
      await bff.post('/api/bff/cart/comparison', { productId: product.id });
      setFeedback({
        type: 'success',
        message: 'Đã thêm vào danh sách so sánh.',
      });
    } catch (error) {
      setFeedback({ type: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.price}>
        {formatVnd(selectedSku.price?.amount ?? 0)}
      </div>

      {skus.length > 1 ? (
        <div className={styles.variants}>
          <span className="nt-label">Phiên bản</span>
          <div className={styles.variantList}>
            {skus.map((sku) => (
              <button
                key={sku.id}
                type="button"
                className={
                  sku.id === selectedSku.id
                    ? styles.variantActive
                    : styles.variant
                }
                onClick={() => setSelectedSkuId(sku.id)}
              >
                {sku.name ||
                  formatVariantAttributes(sku.attributes) ||
                  sku.skuCode}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.stockRow}>
        {stockLoading ? (
          <span className="nt-badge">Đang kiểm tra tồn kho…</span>
        ) : inStock ? (
          <span className="nt-badge nt-badge--success">
            Còn hàng · {stockSources.length} điểm cung ứng
          </span>
        ) : (
          <span className="nt-badge nt-badge--danger">Tạm hết hàng</span>
        )}
      </div>

      <div className={styles.quantityRow}>
        <span className="nt-label">Số lượng</span>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="Giảm số lượng"
            onClick={() => setQuantity((q) => clampCartQuantity(q - 1))}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) =>
              setQuantity(clampCartQuantity(Number(event.target.value)))
            }
            aria-label="Số lượng sản phẩm"
          />
          <button
            type="button"
            aria-label="Tăng số lượng"
            onClick={() => setQuantity((q) => clampCartQuantity(q + 1))}
          >
            +
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          className={
            feedback.type === 'success' ? 'nt-form-success' : 'nt-form-error'
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className={styles.actionRow}>
        <button
          type="button"
          className="nt-btn nt-btn--outline nt-btn--block"
          onClick={handleAddToCart}
          disabled={mutating || !inStock}
        >
          Thêm vào giỏ hàng
        </button>
        <button
          type="button"
          className="nt-btn nt-btn--primary nt-btn--block"
          onClick={handleBuyNow}
          disabled={mutating || !inStock}
        >
          Mua ngay
        </button>
      </div>

      <div className={styles.secondaryRow}>
        <button
          type="button"
          className="nt-btn nt-btn--ghost nt-btn--sm"
          onClick={handleAddWishlist}
        >
          {wishlistState === 'saved'
            ? '✓ Đã lưu yêu thích'
            : '♡ Thêm vào yêu thích'}
        </button>
        <button
          type="button"
          className="nt-btn nt-btn--ghost nt-btn--sm"
          onClick={handleAddCompare}
        >
          ⇄ So sánh sản phẩm
        </button>
      </div>
    </div>
  );
}
