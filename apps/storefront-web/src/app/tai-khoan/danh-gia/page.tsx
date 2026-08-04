'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

export default function Page() {
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/review/reviews/me')
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        setItems(list);
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
        role="status"
        aria-busy="true"
      >
        Đang tải đánh giá…
      </div>
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
        title="Bạn chưa có đánh giá"
        description="Sau khi mua và nhận hàng, bạn có thể đánh giá sản phẩm từ đơn hàng đủ điều kiện."
        action={
          <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-primary">
            Xem đơn hàng để đánh giá
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Đánh giá của tôi</h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        {items.map((item, index) => {
          const record = item as Record<string, unknown>;
          const id = String(record.id ?? index);
          const label = String(
            record.productName ??
              record.title ??
              record.skuCode ??
              `Đánh giá ${id.slice(0, 8)}`,
          );
          return (
            <li
              key={id}
              style={{
                border: '1px solid #dbeafe',
                borderRadius: 12,
                padding: '0.85rem',
                background: '#fff',
              }}
            >
              <strong>{label}</strong>
              {record.rating != null ? (
                <div style={{ color: '#4b6478' }}>
                  Điểm: {String(record.rating)}/5
                </div>
              ) : null}
              {record.status ? (
                <div style={{ color: '#4b6478' }}>
                  Trạng thái: {String(record.status)}
                </div>
              ) : null}
              {record.content ? (
                <p style={{ marginBottom: 0 }}>{String(record.content)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
