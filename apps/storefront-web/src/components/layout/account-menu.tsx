'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../providers/auth-provider';
import styles from './account-menu.module.css';

export function AccountMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className={styles.guestLinks}>
        <Link href="/dang-nhap" className={styles.guestLink}>
          Đăng nhập
        </Link>
        <Link href="/dang-ky" className="nt-btn nt-btn--primary nt-btn--sm">
          Đăng ký
        </Link>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  const displayName = user?.fullName || user?.email || 'Tài khoản';

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Menu tài khoản của ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={styles.avatar}>
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className={styles.name}>{displayName}</span>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <Link
            href="/tai-khoan"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Tổng quan tài khoản
          </Link>
          <Link
            href="/tai-khoan/don-hang"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Đơn hàng của tôi
          </Link>
          <Link
            href="/tai-khoan/yeu-thich"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Sản phẩm yêu thích
          </Link>
          <button
            type="button"
            className={styles.menuItemButton}
            role="menuitem"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}
