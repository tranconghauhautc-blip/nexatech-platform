'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { PasswordField } from '../../components/common/password-field';
import { resetPasswordRequestSchema } from '../../lib/validation';
import styles from './page.module.css';

function ResetForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get('email') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = resetPasswordRequestSchema.safeParse({
      email,
      code,
      newPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      await bff.post('/api/auth/reset-password', parsed.data);
      setSuccess('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.');
      setTimeout(() => router.push('/dang-nhap'), 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Đặt lại mật khẩu</h1>
      <p className={styles.lead}>Nhập email, mã OTP và mật khẩu mới</p>
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
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <PasswordField
          id="newPassword"
          label="Mật khẩu mới"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          required
        />
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
            {loading ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <Link href="/dang-nhap">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="nt-container">Đang tải…</div>}>
      <ResetForm />
    </Suspense>
  );
}
