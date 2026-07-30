'use client';

import { useState } from 'react';
import type { Role } from '@nexatech/shared-auth';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './AdminShell.module.css';

export function AdminShell({
  email,
  roles,
  children,
}: {
  email: string;
  roles: Role[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar
        roles={roles}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      {mobileOpen ? (
        <div className={styles.scrim} onClick={() => setMobileOpen(false)} />
      ) : null}
      <div className={styles.content}>
        <Topbar
          email={email}
          roles={roles}
          onToggleSidebar={() => setMobileOpen((open) => !open)}
        />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
