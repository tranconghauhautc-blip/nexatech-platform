'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import type { NavCategory } from '../../lib/categories';
import { AccountMenu } from './account-menu';
import { CartBadge } from './cart-badge';
import { SearchBox } from './search-box';
import styles from './site-header.module.css';

interface SiteHeaderProps {
  categories: NavCategory[];
  categoriesError?: boolean;
}

export function SiteHeader({
  categories,
  categoriesError = false,
}: SiteHeaderProps) {
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
          {categories.length > 0 ? (
            categories.map((category) => (
              <Link
                key={category.slug}
                href={`/danh-muc/${category.slug}`}
                className={styles.categoryLink}
              >
                {category.label}
              </Link>
            ))
          ) : categoriesError ? (
            <span className={styles.categoryError}>
              Không tải được danh mục
            </span>
          ) : null}
        </div>
      </nav>

      {mobileOpen ? (
        <div className={styles.mobileMenu}>
          <Suspense fallback={null}>
            <SearchBox className={styles.mobileSearch} />
          </Suspense>
          {categories.length > 0 ? (
            categories.map((category) => (
              <Link
                key={category.slug}
                href={`/danh-muc/${category.slug}`}
                className={styles.mobileLink}
                onClick={() => setMobileOpen(false)}
              >
                {category.label}
              </Link>
            ))
          ) : categoriesError ? (
            <p className={styles.categoryError}>Không tải được danh mục</p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
