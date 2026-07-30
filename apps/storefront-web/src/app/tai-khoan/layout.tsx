'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ACCOUNT_NAV } from '../../lib/constants';
import { useAuth } from '../../components/providers/auth-provider';
import styles from './layout.module.css';

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
                  pathname === item.href ||
                  (item.href !== '/tai-khoan' && pathname.startsWith(item.href))
                    ? styles.active
                    : styles.link
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className={styles.content}>{children}</section>
    </div>
  );
}
