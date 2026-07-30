'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { loginFormSchema } from '../../lib/validation';
import { useAuth } from '../../components/providers/auth-provider';
import styles from './page.module.css';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { refresh, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleClientId =
    process.env['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'] ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      const result = await bff.post<{
        user: { userId: string; email?: string; roles: string[] };
      }>('/api/auth/login', parsed.data);
      setUser({
        userId: result.user.userId,
        email: result.user.email,
        roles: result.user.roles,
      });
      await refresh();
      try {
        await bff.post('/api/bff/cart/carts/merge', {});
      } catch {
        // optional when no guest cart
      }
      router.push(search.get('next') || '/tai-khoan');
    } catch (err) {
      setError(getErrorMessage(err, 'Đăng nhập thất bại'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Đăng nhập</h1>
      <p className={styles.lead}>Chào mừng trở lại NexaTech</p>
      <form onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          {googleClientId ? (
            <button
              type="button"
              className="nt-btn nt-btn-ghost"
              disabled
              title="Google OAuth chờ cấu hình credential backend"
            >
              Đăng nhập với Google
            </button>
          ) : null}
        </div>
      </form>
      <div className={styles.links}>
        <Link href="/quen-mat-khau">Quên mật khẩu?</Link>
        <Link href="/dang-ky">Tạo tài khoản</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="nt-container" style={{ padding: '2rem' }}>
          Đang tải…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
