'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { SORT_OPTIONS } from '../../lib/constants';
import styles from './product-filters.module.css';

interface Props {
  basePath: string;
  current: {
    q?: string;
    brandSlug?: string;
    sort?: string;
    page?: number;
  };
}

export function ProductFilters({ basePath, current }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? '');
  const [brandSlug, setBrandSlug] = useState(current.brandSlug ?? '');
  const [sort, setSort] = useState(current.sort ?? 'newest');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (brandSlug.trim()) params.set('brandSlug', brandSlug.trim());
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

      <label className={styles.label} htmlFor="filter-brand">
        Thương hiệu (slug)
      </label>
      <input
        id="filter-brand"
        className={styles.input}
        value={brandSlug}
        onChange={(e) => setBrandSlug(e.target.value)}
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
