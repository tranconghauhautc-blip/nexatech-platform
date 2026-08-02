'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { EmptyState } from '../../../components/common/empty-state';
import { MediaThumb } from '../../../components/media/media-thumb';
import { bff, getErrorMessage } from '../../../lib/api-browser';

interface WishlistRow {
  id: string;
  productId: string;
  name?: string;
  slug?: string;
  minPrice?: number;
  status?: string;
  thumbnailUrl?: string;
  missing?: boolean;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/cart/wishlist')
      .then(async (data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        const rows = list as Array<Record<string, unknown>>;
        const productIds = rows
          .map((r) => String(r['productId'] ?? ''))
          .filter(Boolean);
        let summaries: Array<Record<string, unknown>> = [];
        if (productIds.length > 0) {
          try {
            const result = await bff.get(
              `/api/bff/catalog/products/summaries?ids=${encodeURIComponent(productIds.join(','))}`,
            );
            summaries = Array.isArray(result)
              ? (result as Array<Record<string, unknown>>)
              : [];
          } catch {
            summaries = [];
          }
        }
        const byId = new Map(summaries.map((s) => [String(s['id']), s]));
        setItems(
          rows.map((r, index) => {
            const productId = String(r['productId'] ?? '');
            const summary = byId.get(productId);
            return {
              id: String(r['id'] ?? productId ?? index),
              productId,
              name: summary ? String(summary['name'] ?? '') : undefined,
              slug: summary ? String(summary['slug'] ?? '') : undefined,
              minPrice:
                typeof summary?.['minPrice'] === 'number'
                  ? (summary['minPrice'] as number)
                  : undefined,
              status: summary ? String(summary['status'] ?? '') : undefined,
              thumbnailUrl: summary
                ? String(summary['thumbnailUrl'] ?? '')
                : undefined,
              missing: !summary,
            };
          }),
        );
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
            Tiếp tục mua sắm
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
        {items.map((item) => {
          const unavailable =
            item.missing ||
            item.status === 'ARCHIVED' ||
            item.status === 'UNPUBLISHED';
          return (
            <li
              key={item.id}
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
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <MediaThumb
                  mediaRef={item.thumbnailUrl}
                  alt={item.name ?? 'Sản phẩm'}
                />
                <div>
                  <strong>
                    {unavailable
                      ? (item.name ?? 'Không còn kinh doanh')
                      : (item.name ?? 'Sản phẩm')}
                  </strong>
                  {unavailable ? (
                    <div style={{ color: '#b45309' }}>Không còn kinh doanh</div>
                  ) : (
                    <div style={{ color: '#0b1f3a' }}>
                      {typeof item.minPrice === 'number'
                        ? formatVnd(item.minPrice)
                        : '—'}
                    </div>
                  )}
                  {item.slug && !unavailable ? (
                    <div>
                      <Link href={`/san-pham/${item.slug}`}>Xem sản phẩm</Link>
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="nt-btn nt-btn-ghost"
                disabled={busyId === item.id}
                onClick={() => removeItem(item.productId || item.id)}
              >
                {busyId === item.id ? 'Đang xóa…' : 'Xóa'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
