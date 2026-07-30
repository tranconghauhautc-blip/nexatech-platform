'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { forgotPasswordRequestSchema } from '../../lib/validation';
import styles from './page.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const parsed = forgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      const result = await bff.post<{ debugOtp?: string }>(
        '/api/auth/forgot-password',
        parsed.data,
      );
      setSuccess(
        'Nếu email tồn tại, mã OTP đã được gửi. Kiểm tra hộp thư hoặc dùng mã debug nếu môi trường non-prod.',
      );
      if (result.debugOtp) {
        setDebugOtp(result.debugOtp);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Quên mật khẩu</h1>
      <p className={styles.lead}>Nhập email để nhận mã đặt lại mật khẩu</p>
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
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {success ? <p className={styles.success}>{success}</p> : null}
        {debugOtp ? (
          <p className={styles.success}>OTP debug: {debugOtp}</p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="submit"
            className="nt-btn nt-btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang gửi…' : 'Gửi mã OTP'}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <Link href={`/dat-lai-mat-khau?email=${encodeURIComponent(email)}`}>
          Đã có mã? Đặt lại mật khẩu
        </Link>
        <Link href="/dang-nhap">Đăng nhập</Link>
      </div>
    </div>
  );
}
