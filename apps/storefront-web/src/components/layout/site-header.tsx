'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { NAV_CATEGORIES } from '../../lib/constants';
import { AccountMenu } from './account-menu';
import { CartBadge } from './cart-badge';
import { SearchBox } from './search-box';
import styles from './site-header.module.css';

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={styles.root}>
      <div className={styles.topBar}>
        <div className={`nt-container ${styles.topBarInner}`}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="NexaTech - Trang chủ"
          >
            <span className={styles.logoMark}>N</span>
            <span className={styles.logoText}>
              Nexa<span className={styles.logoAccent}>Tech</span>
            </span>
          </Link>

          <Suspense fallback={<div className={styles.searchFallback} />}>
            <SearchBox className={styles.search} />
          </Suspense>

          <div className={styles.actions}>
            <AccountMenu />
            <CartBadge />
            <button
              type="button"
              className={styles.mobileToggle}
              aria-label="Mở menu danh mục"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <nav className={styles.categoryNav} aria-label="Danh mục sản phẩm">
        <div className={`nt-container ${styles.categoryNavInner}`}>
          {NAV_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/danh-muc/${category.slug}`}
              className={styles.categoryLink}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </nav>

      {mobileOpen ? (
        <div className={styles.mobileMenu}>
          <Suspense fallback={null}>
            <SearchBox className={styles.mobileSearch} />
          </Suspense>
          {NAV_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/danh-muc/${category.slug}`}
              className={styles.mobileLink}
              onClick={() => setMobileOpen(false)}
            >
              {category.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
