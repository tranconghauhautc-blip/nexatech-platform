'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@nexatech/shared-auth';
import {
  ADMIN_MENU_ITEMS,
  MENU_GROUP_LABELS,
  filterMenuByRoles,
  type AdminMenuItem,
} from '../../lib/menu';
import styles from './Sidebar.module.css';

function groupItems(
  items: AdminMenuItem[],
): Array<[AdminMenuItem['group'], AdminMenuItem[]]> {
  const order: AdminMenuItem['group'][] = [
    'chinh',
    'san-pham',
    'van-hanh',
    'cham-soc',
    'he-thong',
  ];
  return order
    .map(
      (group) =>
        [group, items.filter((item) => item.group === group)] as [
          AdminMenuItem['group'],
          AdminMenuItem[],
        ],
    )
    .filter(([, groupedItems]) => groupedItems.length > 0);
}

export function Sidebar({
  roles,
  mobileOpen,
  onNavigate,
}: {
  roles: Role[];
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = filterMenuByRoles(ADMIN_MENU_ITEMS, roles);
  const grouped = groupItems(visibleItems);

  return (
    <aside
      className={`${styles.sidebar} ${mobileOpen ? styles.open : ''} nx-scrollbar`}
    >
      <div className={styles.brand}>
        <span className={styles.brandMark}>N</span>
        <div>
          <div className={styles.brandName}>NexaTech</div>
          <div className={styles.brandSub}>Admin Portal</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {grouped.map(([group, items]) => (
          <div key={group} className={styles.group}>
            <div className={styles.groupLabel}>{MENU_GROUP_LABELS[group]}</div>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
