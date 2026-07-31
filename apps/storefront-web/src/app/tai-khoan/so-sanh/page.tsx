'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

export default function ComparePage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/cart/comparison')
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

  const specKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      const specs = item['specs'] as Record<string, unknown> | undefined;
      if (specs && typeof specs === 'object') {
        Object.keys(specs).forEach((k) => keys.add(k));
      }
      const attrs = item['attributes'] as Record<string, unknown> | undefined;
      if (attrs && typeof attrs === 'object') {
        Object.keys(attrs).forEach((k) => keys.add(k));
      }
    }
    return [...keys];
  }, [items]);

  async function removeItem(id: string) {
    try {
      await bff.delete(`/api/bff/cart/comparison/${encodeURIComponent(id)}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
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
        title="So sánh sản phẩm"
        description="Chưa có sản phẩm để so sánh."
        action={
          <Link href="/" className="nt-btn nt-btn-primary">
            Về trang chủ
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>So sánh sản phẩm</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, border: '1px solid #dbeafe' }}>
              Thông số
            </th>
            {items.map((item, index) => {
              const id = String(item['id'] ?? item['productId'] ?? index);
              const name = String(
                item['productName'] ?? item['name'] ?? item['title'] ?? id,
              );
              return (
                <th
                  key={id}
                  style={{
                    textAlign: 'left',
                    padding: 8,
                    border: '1px solid #dbeafe',
                    minWidth: 160,
                  }}
                >
                  <div>{name}</div>
                  <button
                    type="button"
                    className="nt-btn nt-btn-ghost"
                    style={{ marginTop: 8 }}
                    onClick={() => removeItem(id)}
                  >
                    Xóa
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #dbeafe' }}>Giá</td>
            {items.map((item, index) => (
              <td
                key={String(item['id'] ?? index)}
                style={{ padding: 8, border: '1px solid #dbeafe' }}
              >
                {String(item['minPrice'] ?? item['price'] ?? '—')}
              </td>
            ))}
          </tr>
          {specKeys.map((key) => (
            <tr key={key}>
              <td style={{ padding: 8, border: '1px solid #dbeafe' }}>{key}</td>
              {items.map((item, index) => {
                const specs =
                  (item['specs'] as Record<string, unknown> | undefined) ??
                  (item['attributes'] as Record<string, unknown> | undefined) ??
                  {};
                return (
                  <td
                    key={String(item['id'] ?? index)}
                    style={{ padding: 8, border: '1px solid #dbeafe' }}
                  >
                    {String(specs[key] ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
