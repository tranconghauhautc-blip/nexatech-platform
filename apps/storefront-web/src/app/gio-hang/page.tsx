'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CartValidationIssue } from '@nexatech/shared-contracts';
import { formatVnd } from '@nexatech/shared-web';
import { useCart } from '../../components/providers/cart-provider';
import { EmptyState } from '../../components/common/empty-state';
import { bff, getErrorMessage } from '../../lib/api-browser';
import styles from './page.module.css';

export default function CartPage() {
  const {
    cart,
    loading,
    error,
    subtotal,
    refresh,
    updateItem,
    removeItem,
    mutating,
  } = useCart();
  const [actionError, setActionError] = useState<string | null>(null);
  const [issues, setIssues] = useState<CartValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);

  async function onRefreshPrices() {
    setBusy(true);
    setActionError(null);
    try {
      await bff.post('/api/bff/cart/carts/current/refresh');
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onValidate() {
    setBusy(true);
    setActionError(null);
    try {
      const result = await bff.post<{ issues?: CartValidationIssue[] }>(
        '/api/bff/cart/carts/current/validate',
      );
      setIssues(result.issues ?? []);
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !cart) {
    return (
      <div
        className="nt-container nt-skeleton"
        style={{ margin: '2rem auto', minHeight: 200 }}
        aria-busy="true"
        aria-label="Đang tải giỏ hàng"
      />
    );
  }

  if (error) {
    return (
      <div className="nt-container" style={{ padding: '2rem 0' }}>
        <EmptyState
          title="Không tải được giỏ hàng"
          description={error}
          action={
            <button
              type="button"
              className="nt-btn nt-btn-primary"
              onClick={() => void refresh()}
            >
              Thử lại
            </button>
          }
        />
      </div>
    );
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="nt-container" style={{ padding: '2rem 0' }}>
        <EmptyState
          title="Giỏ hàng trống"
          description="Hãy thêm sản phẩm từ trang danh mục."
          action={
            <Link href="/tim-kiem" className="nt-btn nt-btn-primary">
              Tiếp tục mua sắm
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={`nt-container ${styles.root}`}>
      <h1 className={styles.title}>Giỏ hàng</h1>
      {actionError ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}
      {issues.length > 0 ? (
        <ul className={styles.issues} aria-live="polite">
          {issues.map((issue) => (
            <li key={`${issue.skuId}-${issue.code}`}>
              {issue.message || issue.code}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.skuId} className={styles.item}>
            <div>
              <Link
                href={`/san-pham/${item.productSlug}`}
                className={styles.name}
              >
                {item.productName}
              </Link>
              <div className={styles.meta}>
                {item.skuCode}
                {item.skuName ? ` · ${item.skuName}` : ''}
              </div>
              {item.priceChanged ? (
                <div className={styles.warn}>
                  Giá đã thay đổi so với lúc thêm vào giỏ
                </div>
              ) : null}
              {item.available === false ? (
                <div className={styles.warn}>Sản phẩm tạm hết hàng</div>
              ) : null}
            </div>
            <div className={styles.qty}>
              <label htmlFor={`qty-${item.skuId}`}>Số lượng</label>
              <input
                id={`qty-${item.skuId}`}
                type="number"
                min={1}
                max={99}
                defaultValue={item.quantity}
                disabled={mutating || busy}
                onBlur={async (event) => {
                  const quantity = Number(event.target.value);
                  if (!Number.isFinite(quantity) || quantity < 1) {
                    return;
                  }
                  try {
                    await updateItem(item.skuId, quantity);
                  } catch (err) {
                    setActionError(getErrorMessage(err));
                  }
                }}
              />
            </div>
            <div className={styles.price}>{formatVnd(item.lineSubtotal)}</div>
            <button
              type="button"
              className={styles.remove}
              disabled={mutating || busy}
              onClick={async () => {
                try {
                  await removeItem(item.skuId);
                } catch (err) {
                  setActionError(getErrorMessage(err));
                }
              }}
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.summary}>
        <div>
          <div className={styles.subtotalLabel}>Tạm tính (hiển thị)</div>
          <div className={styles.subtotal}>
            {formatVnd(cart?.subtotal ?? subtotal)}
          </div>
          <p className={styles.note}>
            Tổng thanh toán cuối cùng do máy chủ tính khi checkout. Không áp
            dụng voucher.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="nt-btn nt-btn-ghost"
            disabled={busy}
            onClick={() => void onRefreshPrices()}
          >
            Làm mới giá
          </button>
          <button
            type="button"
            className="nt-btn nt-btn-ghost"
            disabled={busy}
            onClick={() => void onValidate()}
          >
            Kiểm tra tồn kho
          </button>
          <Link href="/thanh-toan" className="nt-btn nt-btn-primary">
            Tiến hành thanh toán
          </Link>
        </div>
      </div>
    </div>
  );
}
