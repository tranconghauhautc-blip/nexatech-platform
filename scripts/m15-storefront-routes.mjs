/**
 * Storefront route pages generator
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(rel);
}

w(
  'apps/storefront-web/src/app/danh-muc/[slug]/page.tsx',
  `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '../../../components/product/product-grid';
import { EmptyState } from '../../../components/common/empty-state';
import { Pagination } from '../../../components/common/pagination';
import { Breadcrumbs } from '../../../components/common/breadcrumbs';
import { ProductFilters } from '../../../components/catalog/product-filters';
import {
  findCategoryBySlug,
  getCategoryTree,
  searchProducts,
} from '../../../lib/catalog-server';
import { NAV_CATEGORIES } from '../../../lib/constants';
import styles from './page.module.css';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const label = NAV_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
  return {
    title: label,
    description: \`Mua \${label} chính hãng tại NexaTech\`,
    alternates: { canonical: \`/danh-muc/\${slug}\` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(first(sp.page) ?? '1') || 1;
  const sort = (first(sp.sort) as 'newest' | 'price_asc' | 'price_desc' | 'name' | 'relevance') || 'newest';
  const q = first(sp.q);
  const brandSlug = first(sp.brandSlug);

  const tree = await getCategoryTree();
  const category = findCategoryBySlug(tree, slug) ?? NAV_CATEGORIES.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const result = await searchProducts({
    categorySlug: slug,
    page,
    pageSize: 12,
    sort,
    q,
    brandSlug,
  });

  const label = 'name' in category ? category.name : category.label;

  return (
    <div className={\`nt-container \${styles.root}\`}>
      <Breadcrumbs items={[{ label: 'Trang chủ', href: '/' }, { label }]} />
      <header className={styles.header}>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.lead}>
          {result.meta.totalItems} sản phẩm · sắp xếp và lọc theo nhu cầu của bạn
        </p>
      </header>
      <div className={styles.layout}>
        <ProductFilters
          basePath={\`/danh-muc/\${slug}\`}
          current={{ q, brandSlug, sort, page }}
        />
        <div>
          {result.items.length === 0 ? (
            <EmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử đổi bộ lọc hoặc tìm kiếm với từ khóa khác."
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                page={result.meta.page}
                totalPages={result.meta.totalPages}
                basePath={\`/danh-muc/\${slug}\`}
                query={{ q, brandSlug, sort }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/danh-muc/[slug]/page.module.css',
  `.root { padding: 1.5rem 0 3rem; }
.header { margin: 1rem 0 1.5rem; }
.title { margin: 0 0 0.35rem; font-family: var(--font-space-grotesk), sans-serif; color: #0b1f3a; }
.lead { margin: 0; color: #4b6478; }
.layout { display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
`,
);

w(
  'apps/storefront-web/src/components/catalog/product-filters.tsx',
  `'use client';

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
    router.push(qs ? \`\${basePath}?\${qs}\` : basePath);
  }

  return (
    <form className={styles.root} onSubmit={onSubmit} aria-label="Bộ lọc sản phẩm">
      <label className={styles.label} htmlFor="filter-q">Từ khóa</label>
      <input id="filter-q" className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} />

      <label className={styles.label} htmlFor="filter-brand">Thương hiệu (slug)</label>
      <input id="filter-brand" className={styles.input} value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)} />

      <label className={styles.label} htmlFor="filter-sort">Sắp xếp</label>
      <select id="filter-sort" className={styles.input} value={sort} onChange={(e) => setSort(e.target.value)}>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <button type="submit" className="nt-btn nt-btn-primary">Áp dụng</button>
    </form>
  );
}
`,
);

w(
  'apps/storefront-web/src/components/catalog/product-filters.module.css',
  `.root {
  display: flex; flex-direction: column; gap: 0.55rem;
  padding: 1rem; border: 1px solid #dbeafe; border-radius: 12px; background: #f8fbff;
}
.label { font-size: 0.85rem; font-weight: 600; color: #0b1f3a; }
.input {
  border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.55rem 0.7rem; font: inherit;
}
.input:focus-visible { outline: 2px solid #0284c7; outline-offset: 1px; }
`,
);

w(
  'apps/storefront-web/src/app/tim-kiem/page.tsx',
  `import type { Metadata } from 'next';
import { ProductGrid } from '../../components/product/product-grid';
import { EmptyState } from '../../components/common/empty-state';
import { Pagination } from '../../components/common/pagination';
import { ProductFilters } from '../../components/catalog/product-filters';
import { searchProducts } from '../../lib/catalog-server';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: 'Tìm kiếm',
  description: 'Tìm sản phẩm công nghệ tại NexaTech',
  alternates: { canonical: '/tim-kiem' },
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q) ?? '';
  const page = Number(first(sp.page) ?? '1') || 1;
  const sort = (first(sp.sort) as 'newest' | 'price_asc' | 'price_desc' | 'name' | 'relevance') || 'relevance';
  const brandSlug = first(sp.brandSlug);
  const categorySlug = first(sp.categorySlug);

  const result = await searchProducts({ q, page, pageSize: 12, sort, brandSlug, categorySlug });

  return (
    <div className="nt-container" style={{ padding: '1.5rem 0 3rem' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
        {q ? \`Kết quả cho “\${q}”\` : 'Tìm kiếm sản phẩm'}
      </h1>
      <p style={{ color: '#4b6478' }}>{result.meta.totalItems} sản phẩm phù hợp</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,240px) 1fr', gap: '1.5rem', marginTop: '1.25rem' }}>
        <ProductFilters basePath="/tim-kiem" current={{ q, brandSlug, sort, page }} />
        <div>
          {result.items.length === 0 ? (
            <EmptyState title="Không có kết quả" description="Thử từ khóa khác hoặc bỏ bớt bộ lọc." />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination page={result.meta.page} totalPages={result.meta.totalPages} basePath="/tim-kiem" query={{ q, brandSlug, sort, categorySlug }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
`,
);

console.log('listing pages ok');
