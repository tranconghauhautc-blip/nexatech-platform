'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { reflectSearchQuery } from '@nexatech/shared-security-lab';
import { SORT_OPTIONS } from '../../lib/constants';
import styles from './product-filters.module.css';

interface Props {
  basePath: string;
  current: {
    q?: string;
    brandSlug?: string;
    sort?: string;
    page?: number;
    minPrice?: string;
    maxPrice?: string;
  };
  /** SC-72 reflected XSS echo — raw query for WAF PoC when provided */
  reflectHtml?: string;
}

export function ProductFilters({ basePath, current, reflectHtml }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? '');
  const [brandSlug, setBrandSlug] = useState(current.brandSlug ?? '');
  const [sort, setSort] = useState(current.sort ?? 'newest');
  const [minPrice, setMinPrice] = useState(current.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ?? '');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (brandSlug.trim()) params.set('brandSlug', brandSlug.trim());
    if (minPrice.trim()) params.set('minPrice', minPrice.trim());
    if (maxPrice.trim()) params.set('maxPrice', maxPrice.trim());
    if (sort) params.set('sort', sort);
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <form
      className={styles.root}
      onSubmit={onSubmit}
      aria-label="Bộ lọc sản phẩm"
    >
      <label className={styles.label} htmlFor="filter-q">
        Từ khóa
      </label>
      <input
        id="filter-q"
        className={styles.input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {reflectHtml ? (
        <div
          className={styles.label}
          // INTENTIONAL SC-72: reflected XSS for WAF PoC (no HTML encode)
          dangerouslySetInnerHTML={{
            __html: `Kết quả cho: ${reflectSearchQuery({ q: reflectHtml })}`,
          }}
        />
      ) : null}

      <label className={styles.label} htmlFor="filter-brand">
        Thương hiệu (slug)
      </label>
      <input
        id="filter-brand"
        className={styles.input}
        value={brandSlug}
        onChange={(e) => setBrandSlug(e.target.value)}
        placeholder="apple, samsung…"
      />

      <label className={styles.label} htmlFor="filter-min">
        Giá từ
      </label>
      <input
        id="filter-min"
        className={styles.input}
        type="number"
        min={0}
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
      />

      <label className={styles.label} htmlFor="filter-max">
        Giá đến
      </label>
      <input
        id="filter-max"
        className={styles.input}
        type="number"
        min={0}
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
      />

      <label className={styles.label} htmlFor="filter-sort">
        Sắp xếp
      </label>
      <select
        id="filter-sort"
        className={styles.input}
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button type="submit" className="nt-btn nt-btn-primary">
        Áp dụng
      </button>
    </form>
  );
}
