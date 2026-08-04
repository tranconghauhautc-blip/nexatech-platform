'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ACCOUNT_NAV } from '../../lib/constants';
import { useAuth } from '../../components/providers/auth-provider';
import styles from './layout.module.css';

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/tai-khoan') return false;
  return pathname.startsWith(href);
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return (
      <div
        className="nt-container nt-skeleton"
        style={{ minHeight: 200, margin: '2rem auto' }}
        role="status"
        aria-busy="true"
      >
        Đang tải tài khoản…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const activeHref =
    ACCOUNT_NAV.find((item) => isActivePath(pathname, item.href))?.href ??
    '/tai-khoan';

  return (
    <div className={`nt-container ${styles.root}`}>
      <aside className={styles.nav} aria-label="Menu tài khoản">
        <h1 className={styles.title}>Tài khoản</h1>
        <ul className={styles.list}>
          {ACCOUNT_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  isActivePath(pathname, item.href)
                    ? styles.active
                    : styles.link
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <label
          htmlFor="account-nav-select"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Chọn mục tài khoản
        </label>
        <select
          id="account-nav-select"
          className={styles.mobileSelect}
          value={activeHref}
          onChange={(e) => router.push(e.target.value)}
        >
          {ACCOUNT_NAV.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </aside>
      <section className={styles.content}>{children}</section>
    </div>
  );
}
