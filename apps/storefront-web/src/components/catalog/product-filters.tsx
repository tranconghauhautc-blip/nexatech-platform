'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { reflectSearchQuery } from '@nexatech/shared-security-lab';
import { SORT_OPTIONS } from '../../lib/constants';
import type { ProductFacetBrand } from '../../lib/types';
import styles from './product-filters.module.css';

export interface FilterCategoryOption {
  slug: string;
  name: string;
}

interface Props {
  basePath: string;
  current: {
    q?: string;
    brandSlug?: string;
    categorySlug?: string;
    sort?: string;
    page?: number;
    minPrice?: string;
    maxPrice?: string;
  };
  /** Brands available for current category/scope (from facets API). */
  brandFacets: ProductFacetBrand[];
  priceRange?: { min: number; max: number } | null;
  /** Optional category dropdown (search page). Omit on category PLP. */
  categories?: FilterCategoryOption[];
  /** SC-72 reflected XSS echo — raw query for WAF PoC when provided */
  reflectHtml?: string;
}

export function ProductFilters({
  basePath,
  current,
  brandFacets,
  priceRange,
  categories,
  reflectHtml,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? '');
  const [brandSlug, setBrandSlug] = useState(current.brandSlug ?? '');
  const [categorySlug, setCategorySlug] = useState(current.categorySlug ?? '');
  const [sort, setSort] = useState(current.sort ?? 'newest');
  const [minPrice, setMinPrice] = useState(current.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ?? '');

  const facetSlugs = useMemo(
    () => new Set(brandFacets.map((b) => b.slug)),
    [brandFacets],
  );

  // Drop brand when it is no longer in the narrowed facet list.
  useEffect(() => {
    if (brandSlug && facetSlugs.size > 0 && !facetSlugs.has(brandSlug)) {
      setBrandSlug('');
    }
  }, [brandSlug, facetSlugs]);

  function onCategoryChange(next: string) {
    setCategorySlug(next);
    setBrandSlug('');
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (brandSlug.trim()) params.set('brandSlug', brandSlug.trim());
    if (categories && categorySlug.trim()) {
      params.set('categorySlug', categorySlug.trim());
    }
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
        placeholder="Tên sản phẩm…"
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

      {categories && categories.length > 0 ? (
        <>
          <label className={styles.label} htmlFor="filter-category">
            Danh mục
          </label>
          <select
            id="filter-category"
            className={styles.input}
            value={categorySlug}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className={styles.label} htmlFor="filter-brand">
        Thương hiệu
      </label>
      <select
        id="filter-brand"
        className={styles.input}
        value={brandSlug}
        onChange={(e) => setBrandSlug(e.target.value)}
        disabled={brandFacets.length === 0}
      >
        <option value="">
          {brandFacets.length === 0
            ? 'Không có thương hiệu phù hợp'
            : 'Tất cả thương hiệu'}
        </option>
        {brandFacets.map((brand) => (
          <option key={brand.id} value={brand.slug}>
            {brand.name} ({brand.productCount})
          </option>
        ))}
      </select>
      <p className={styles.hint}>
        Chỉ hiện thương hiệu có sản phẩm trong phạm vi lọc hiện tại.
      </p>

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
        placeholder={
          priceRange ? String(priceRange.min) : '0'
        }
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
        placeholder={
          priceRange ? String(priceRange.max) : 'Không giới hạn'
        }
      />
      {priceRange ? (
        <p className={styles.hint}>
          Khoảng giá trong phạm vi:{' '}
          {priceRange.min.toLocaleString('vi-VN')} –{' '}
          {priceRange.max.toLocaleString('vi-VN')} ₫
        </p>
      ) : null}

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
