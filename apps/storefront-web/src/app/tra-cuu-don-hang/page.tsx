'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import styles from '../dang-nhap/page.module.css';

export default function GuestTrackingPage() {
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const code = trackingCode.trim();
    if (!code) {
      setError('Nhập mã vận đơn để tra cứu.');
      return;
    }
    setLoading(true);
    try {
      const data = await bff.get(
        `/api/bff/shipping/tracking/${encodeURIComponent(code)}`,
      );
      setResult(data as Record<string, unknown>);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tìm thấy mã vận đơn'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Tra cứu đơn hàng</h1>
      <p className={styles.lead}>
        Nhập mã vận đơn (tracking) để xem trạng thái giao hàng — không cần đăng
        nhập.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="trackingCode">Mã vận đơn</label>
          <input
            id="trackingCode"
            type="text"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="VD: NT-… hoặc MOCK-…"
            required
          />
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="submit"
            className="nt-btn nt-btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang tra cứu…' : 'Tra cứu'}
          </button>
        </div>
      </form>
      {result ? (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            border: '1px solid #dbeafe',
            borderRadius: 12,
            background: '#f8fbff',
          }}
        >
          <strong>Kết quả</strong>
          <pre
            style={{
              margin: '0.75rem 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.85rem',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
      <div className={styles.links}>
        <Link href="/tai-khoan/don-hang">Đơn hàng đã đăng nhập</Link>
        <Link href="/">Về trang chủ</Link>
      </div>
    </div>
  );
}
