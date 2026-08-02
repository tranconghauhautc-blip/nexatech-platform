'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

interface PaymentRow {
  id?: string;
  paymentReference?: string;
  reference?: string;
  orderId?: string;
  orderCode?: string;
  method?: string;
  provider?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  providerTxnId?: string;
  transactionReference?: string;
}

export default function Page() {
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/payment/payments/me')
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        setItems(list as PaymentRow[]);
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
        title="Thanh toán"
        description="Bạn chưa có giao dịch thanh toán."
        action={
          <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-primary">
            Xem đơn hàng
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Lịch sử thanh toán</h2>
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
          const id = String(record.id ?? index);
          const ref = String(record.paymentReference ?? record.reference ?? id);
          const amount =
            typeof record.amount === 'number' ? formatVnd(record.amount) : '—';
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
              <strong>{ref}</strong>
              <div style={{ color: '#4b6478' }}>
                {record.provider ?? record.method ?? '—'} ·{' '}
                {record.status ?? '—'} · {amount}
              </div>
              {record.createdAt ? (
                <div style={{ color: '#4b6478', fontSize: '0.9rem' }}>
                  {new Date(record.createdAt).toLocaleString('vi-VN')}
                </div>
              ) : null}
              {record.orderId ? (
                <div style={{ marginTop: '0.4rem' }}>
                  <Link href={`/tai-khoan/don-hang/${record.orderId}`}>
                    Xem đơn hàng
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
