'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

export default function WishlistPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/cart/wishlist')
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        setItems(list as Record<string, unknown>[]);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      await bff.delete(`/api/bff/cart/wishlist/${encodeURIComponent(id)}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        aria-busy="true"
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description={error}
        action={
          <button
            type="button"
            className="nt-btn nt-btn-primary"
            onClick={load}
          >
            Thử lại
          </button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Yêu thích"
        description="Danh sách yêu thích trống."
        action={
          <Link href="/" className="nt-btn nt-btn-primary">
            Về trang chủ
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Yêu thích</h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        {items.map((record, index) => {
          const id = String(
            record['id'] ?? record['productId'] ?? record['skuId'] ?? index,
          );
          const name = String(
            record['productName'] ??
              record['name'] ??
              record['title'] ??
              record['skuCode'] ??
              id,
          );
          const slug = record['productSlug'] ?? record['slug'];
          return (
            <li
              key={id}
              style={{
                border: '1px solid #dbeafe',
                borderRadius: 12,
                padding: '0.85rem',
                background: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{name}</strong>
                {typeof slug === 'string' ? (
                  <div>
                    <Link href={`/san-pham/${slug}`}>Xem sản phẩm</Link>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="nt-btn nt-btn-ghost"
                disabled={busyId === id}
                onClick={() => removeItem(id)}
              >
                {busyId === id ? 'Đang xóa…' : 'Xóa'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
