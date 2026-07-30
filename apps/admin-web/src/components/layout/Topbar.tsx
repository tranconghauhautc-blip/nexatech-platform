'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './Topbar.module.css';

export function Topbar({
  email,
  roles,
  onToggleSidebar,
}: {
  email: string;
  roles: string[];
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/dang-nhap');
      router.refresh();
    }
  };

  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={onToggleSidebar}
        aria-label="Mở menu"
      >
        ☰
      </button>
      <div className={styles.title}>Bảng điều khiển quản trị</div>
      <div className={styles.spacer} />
      <div className={styles.user}>
        <div className={styles.userInfo}>
          <div className={styles.userEmail}>{email}</div>
          <div className={styles.userRoles}>{roles.join(', ')}</div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-secondary nx-btn-sm"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Đang thoát...' : 'Đăng xuất'}
        </button>
      </div>
    </header>
  );
}
