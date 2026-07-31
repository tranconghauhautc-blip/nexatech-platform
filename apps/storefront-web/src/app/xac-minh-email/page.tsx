'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { verifyEmailRequestSchema } from '../../lib/validation';
import styles from './page.module.css';

function VerifyForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = verifyEmailRequestSchema.safeParse({ email, code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      await bff.post('/api/auth/verify-email', parsed.data);
      setSuccess('Xác minh email thành công. Bạn có thể đăng nhập.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Xác minh email</h1>
      <p className={styles.lead}>Nhập mã OTP đã gửi tới email của bạn</p>
      <form onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="code">Mã OTP</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {success ? <p className={styles.success}>{success}</p> : null}
        <div className={styles.actions}>
          <button
            type="submit"
            className="nt-btn nt-btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang xác minh…' : 'Xác minh'}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <Link href="/dang-nhap">Đăng nhập</Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="nt-container">Đang tải…</div>}>
      <VerifyForm />
    </Suspense>
  );
}
