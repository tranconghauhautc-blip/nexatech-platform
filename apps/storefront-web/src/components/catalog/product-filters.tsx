'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { SORT_OPTIONS } from '../../lib/constants';
import type { ProductFacetBrand } from '../../lib/types';
import styles from './product-filters.module.css';

export interface FilterCategoryOption {
  slug: string;
  name: string;
}

export interface PricePreset {
  id: string;
  label: string;
  min?: number;
  max?: number;
}

/** Khoảng giá kiểu TGDD (triệu đồng). */
export const DEFAULT_PRICE_PRESETS: PricePreset[] = [
  { id: 'u10', label: 'Dưới 10 triệu', max: 10_000_000 },
  { id: '10-20', label: 'Từ 10 - 20 triệu', min: 10_000_000, max: 20_000_000 },
  { id: '20-30', label: 'Từ 20 - 30 triệu', min: 20_000_000, max: 30_000_000 },
  { id: '30+', label: 'Trên 30 triệu', min: 30_000_000 },
];

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
  /** Brands in current category/scope (from facets). */
  brandFacets: ProductFacetBrand[];
  priceRange?: { min: number; max: number } | null;
  /** Search page only — category dropdown. */
  categories?: FilterCategoryOption[];
  /** Category PLP: hide free-text keyword (use header search). */
  hideKeyword?: boolean;
  pricePresets?: PricePreset[];
}

function buildUrl(
  basePath: string,
  current: Props['current'],
  patch: Partial<Props['current']>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.q?.trim()) params.set('q', next.q.trim());
  if (next.brandSlug?.trim()) params.set('brandSlug', next.brandSlug.trim());
  if (next.categorySlug?.trim()) params.set('categorySlug', next.categorySlug.trim());
  if (next.minPrice?.trim()) params.set('minPrice', next.minPrice.trim());
  if (next.maxPrice?.trim()) params.set('maxPrice', next.maxPrice.trim());
  if (next.sort) params.set('sort', next.sort);
  params.set('page', '1');
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function isPresetActive(
  preset: PricePreset,
  minPrice?: string,
  maxPrice?: string,
): boolean {
  const min = minPrice?.trim() ?? '';
  const max = maxPrice?.trim() ?? '';
  const pMin = preset.min !== undefined ? String(preset.min) : '';
  const pMax = preset.max !== undefined ? String(preset.max) : '';
  return min === pMin && max === pMax;
}

export function ProductFilters({
  basePath,
  current,
  brandFacets,
  priceRange,
  categories,
  hideKeyword = false,
  pricePresets = DEFAULT_PRICE_PRESETS,
}: Props) {
  const router = useRouter();

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: Partial<Props['current']> }> =
      [];
    if (current.brandSlug) {
      const brand = brandFacets.find((b) => b.slug === current.brandSlug);
      chips.push({
        key: 'brand',
        label: brand?.name ?? current.brandSlug,
        clear: { brandSlug: '' },
      });
    }
    if (current.minPrice || current.maxPrice) {
      const preset = pricePresets.find((p) =>
        isPresetActive(p, current.minPrice, current.maxPrice),
      );
      chips.push({
        key: 'price',
        label:
          preset?.label ??
          `${current.minPrice || '0'} – ${current.maxPrice || '∞'} ₫`,
        clear: { minPrice: '', maxPrice: '' },
      });
    }
    if (current.categorySlug && categories) {
      const cat = categories.find((c) => c.slug === current.categorySlug);
      chips.push({
        key: 'category',
        label: cat?.name ?? current.categorySlug,
        clear: { categorySlug: '', brandSlug: '' },
      });
    }
    if (!hideKeyword && current.q?.trim()) {
      chips.push({
        key: 'q',
        label: `“${current.q.trim()}”`,
        clear: { q: '' },
      });
    }
    return chips;
  }, [current, brandFacets, categories, hideKeyword, pricePresets]);

  function go(patch: Partial<Props['current']>) {
    router.push(buildUrl(basePath, current, patch));
  }

  function toggleBrand(slug: string) {
    go({ brandSlug: current.brandSlug === slug ? '' : slug });
  }

  function togglePrice(preset: PricePreset) {
    if (isPresetActive(preset, current.minPrice, current.maxPrice)) {
      go({ minPrice: '', maxPrice: '' });
      return;
    }
    go({
      minPrice: preset.min !== undefined ? String(preset.min) : '',
      maxPrice: preset.max !== undefined ? String(preset.max) : '',
    });
  }

  return (
    <aside className={styles.root} aria-label="Bộ lọc sản phẩm">
      <div className={styles.head}>
        <h2 className={styles.title}>Bộ lọc</h2>
        {activeChips.length > 0 ? (
          <button
            type="button"
            className={styles.clearAll}
            onClick={() =>
              go({
                brandSlug: '',
                minPrice: '',
                maxPrice: '',
                q: hideKeyword ? current.q : '',
                categorySlug: categories ? '' : current.categorySlug,
              })
            }
          >
            Xóa lọc
          </button>
        ) : null}
      </div>

      {activeChips.length > 0 ? (
        <div className={styles.chips} aria-label="Đang lọc">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={styles.chip}
              onClick={() => go(chip.clear)}
              title="Bỏ lọc này"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}

      {categories && categories.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.label}>Danh mục</h3>
          <select
            className={styles.input}
            value={current.categorySlug ?? ''}
            onChange={(e) =>
              go({ categorySlug: e.target.value, brandSlug: '' })
            }
            aria-label="Danh mục"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.label}>Hãng</h3>
        {brandFacets.length === 0 ? (
          <p className={styles.empty}>
            Chưa có thương hiệu trong danh mục này.
          </p>
        ) : (
          <ul className={styles.brandList}>
            {brandFacets.map((brand) => {
              const active = current.brandSlug === brand.slug;
              return (
                <li key={brand.id}>
                  <button
                    type="button"
                    className={
                      active ? styles.brandItemActive : styles.brandItem
                    }
                    onClick={() => toggleBrand(brand.slug)}
                    aria-pressed={active}
                  >
                    <span className={styles.brandName}>{brand.name}</span>
                    <span className={styles.brandCount}>
                      {brand.productCount}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.label}>Mức giá</h3>
        <div className={styles.priceList}>
          {pricePresets.map((preset) => {
            const active = isPresetActive(
              preset,
              current.minPrice,
              current.maxPrice,
            );
            return (
              <button
                key={preset.id}
                type="button"
                className={active ? styles.priceChipActive : styles.priceChip}
                onClick={() => togglePrice(preset)}
                aria-pressed={active}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        {priceRange ? (
          <p className={styles.hint}>
            Giá sản phẩm: {priceRange.min.toLocaleString('vi-VN')} –{' '}
            {priceRange.max.toLocaleString('vi-VN')} ₫
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h3 className={styles.label}>Sắp xếp</h3>
        <select
          className={styles.input}
          value={current.sort ?? 'newest'}
          onChange={(e) => go({ sort: e.target.value })}
          aria-label="Sắp xếp"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {!hideKeyword ? (
        <section className={styles.section}>
          <h3 className={styles.label}>Từ khóa</h3>
          <form
            className={styles.keywordForm}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              go({ q: String(fd.get('q') ?? '') });
            }}
          >
            <input
              name="q"
              className={styles.input}
              defaultValue={current.q ?? ''}
              placeholder="Tìm trong kết quả…"
              aria-label="Từ khóa"
            />
            <button type="submit" className={styles.applyBtn}>
              Lọc
            </button>
          </form>
        </section>
      ) : null}
    </aside>
  );
}
