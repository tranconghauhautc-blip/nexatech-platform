'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

export default function Page() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/order/orders')
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
        title="Đơn hàng của tôi"
        description="Bạn chưa có đơn hàng nào."
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
      <h2 style={{ marginTop: 0 }}>Đơn hàng của tôi</h2>
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
          const id = String(record['id'] ?? record['code'] ?? index);
          const code = String(record['code'] ?? id);
          const status = String(record['status'] ?? '—');
          const total = record['grandTotal'];
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
                <strong>{code}</strong>
                <div style={{ color: '#4b6478' }}>Trạng thái: {status}</div>
                {typeof total === 'number' ? (
                  <div style={{ color: '#0b1f3a' }}>
                    {total.toLocaleString('vi-VN')} ₫
                  </div>
                ) : null}
              </div>
              <Link
                href={`/tai-khoan/don-hang/${encodeURIComponent(id)}`}
                className="nt-btn nt-btn-ghost"
              >
                Chi tiết
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
