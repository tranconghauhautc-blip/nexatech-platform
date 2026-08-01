'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PasswordField } from '../../components/ui/PasswordField';
import { loginFormSchema } from '../../lib/validation/auth';
import styles from './page.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/bang-dieu-khien';
  const forbiddenError = searchParams.get('loi') === 'khong_du_quyen';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    forbiddenError
      ? 'Tài khoản của bạn không có quyền truy cập trang quản trị.'
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const raw = await response.text();
      let payload: { message?: string; errorCode?: string } = {};
      if (raw.trim()) {
        try {
          payload = JSON.parse(raw) as { message?: string; errorCode?: string };
        } catch {
          setFormError('Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
          return;
        }
      }
      if (!response.ok) {
        const msg = payload.message?.trim();
        const looksHtml =
          !!msg &&
          (msg.startsWith('<!DOCTYPE') ||
            msg.startsWith('<html') ||
            msg.includes('<script'));
        setFormError(
          !msg || looksHtml
            ? response.status === 401
              ? 'Email hoặc mật khẩu không đúng'
              : 'Đăng nhập thất bại. Vui lòng thử lại.'
            : msg,
        );
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setFormError('Không thể kết nối máy chủ, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>N</span>
          <div>
            <div className={styles.brandName}>NexaTech</div>
            <div className={styles.brandSub}>Admin Portal</div>
          </div>
        </div>
        <h1 className={styles.heading}>Đăng nhập quản trị</h1>
        <p className={styles.subheading}>
          Dành cho Staff, Manager, Admin và Super Admin
        </p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="nx-field">
            <label className="nx-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`nx-input ${fieldErrors.email ? 'nx-input-error' : ''}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="ten@nexatech.vn"
            />
            {fieldErrors.email ? (
              <span className="nx-error-text">{fieldErrors.email}</span>
            ) : null}
          </div>

          <PasswordField
            id="password"
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
            error={fieldErrors.password}
          />

          {formError ? (
            <div className={styles.formError} role="alert">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            className="nx-btn nx-btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: 4 }}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
