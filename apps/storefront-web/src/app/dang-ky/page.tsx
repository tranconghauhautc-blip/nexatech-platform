'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { bff, getErrorMessage } from '../../lib/api-browser';
import { PasswordField } from '../../components/common/password-field';
import { flattenZodErrors, registerFormSchema } from '../../lib/validation';
import styles from './page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = registerFormSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
      agreeTerms: agreeTerms ? true : undefined,
    });
    if (!parsed.success) {
      setFieldErrors(flattenZodErrors(parsed.error));
      return;
    }
    setLoading(true);
    try {
      const result = await bff.post<{ debugOtp?: string }>(
        '/api/auth/register',
        {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          password: parsed.data.password,
        },
      );
      if (result.debugOtp) {
        setDebugOtp(result.debugOtp);
      }
      router.push(
        `/xac-minh-email?email=${encodeURIComponent(parsed.data.email)}`,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Đăng ký thất bại'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Đăng ký</h1>
      <p className={styles.lead}>Tạo tài khoản khách hàng NexaTech</p>
      <form onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="fullName">Họ và tên</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
          {fieldErrors['fullName'] ? (
            <span className={styles.error}>{fieldErrors['fullName']}</span>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {fieldErrors['email'] ? (
            <span className={styles.error}>{fieldErrors['email']}</span>
          ) : null}
        </div>
        <PasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fieldErrors['password']}
          required
        />
        <PasswordField
          id="confirmPassword"
          label="Xác nhận mật khẩu"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={fieldErrors['confirmPassword']}
          required
        />
        <div className={styles.field}>
          <label htmlFor="agreeTerms">
            <input
              id="agreeTerms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />{' '}
            Tôi đồng ý với điều khoản sử dụng
          </label>
          {fieldErrors['agreeTerms'] ? (
            <span className={styles.error}>{fieldErrors['agreeTerms']}</span>
          ) : null}
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {debugOtp ? (
          <p className={styles.success}>Mã OTP debug (non-prod): {debugOtp}</p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="submit"
            className="nt-btn nt-btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang đăng ký…' : 'Đăng ký'}
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <Link href="/dang-nhap">Đã có tài khoản? Đăng nhập</Link>
      </div>
    </div>
  );
}
