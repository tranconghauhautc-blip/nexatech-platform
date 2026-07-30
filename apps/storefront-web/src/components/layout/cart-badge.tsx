'use client';

import Link from 'next/link';
import { useCart } from '../providers/cart-provider';
import styles from './cart-badge.module.css';

export function CartBadge() {
  const { totalQuantity } = useCart();

  return (
    <Link href="/gio-hang" className={styles.root} aria-label="Xem giỏ hàng">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1.4" />
        <circle cx="18" cy="21" r="1.4" />
        <path d="M2.5 3h2l2.6 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" />
      </svg>
      {totalQuantity > 0 ? (
        <span className={styles.count}>
          {totalQuantity > 99 ? '99+' : totalQuantity}
        </span>
      ) : null}
      <span className="nt-visually-hidden">Giỏ hàng</span>
    </Link>
  );
}
