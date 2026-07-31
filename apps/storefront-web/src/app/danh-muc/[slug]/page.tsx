import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '../../../components/product/product-grid';
import { EmptyState } from '../../../components/common/empty-state';
import { Pagination } from '../../../components/common/pagination';
import { Breadcrumbs } from '../../../components/common/breadcrumbs';
import { ProductFilters } from '../../../components/catalog/product-filters';
import {
  findCategoryBySlug,
  getBrands,
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
    description: `Mua ${label} chính hãng tại NexaTech`,
    alternates: { canonical: `/danh-muc/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(first(sp['page']) ?? '1') || 1;
  const sort =
    (first(sp['sort']) as
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'name'
      | 'relevance') || 'newest';
  const q = first(sp['q']);
  const brandSlug = first(sp['brandSlug']);
  const minPrice = first(sp['minPrice']);
  const maxPrice = first(sp['maxPrice']);

  const [tree, brands] = await Promise.all([getCategoryTree(), getBrands()]);
  const category =
    findCategoryBySlug(tree, slug) ??
    NAV_CATEGORIES.find((c) => c.slug === slug);
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
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

  const label = 'name' in category ? category.name : category.label;

  return (
    <div className={`nt-container ${styles.root}`}>
      <Breadcrumbs items={[{ label }]} />
      <header className={styles.header}>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.lead}>
          {result.meta.totalItems} sản phẩm · sắp xếp và lọc theo nhu cầu của
          bạn
        </p>
      </header>
      <div className={styles.layout}>
        <ProductFilters
          basePath={`/danh-muc/${slug}`}
          brands={brands}
          current={{ q, brandSlug, sort, page, minPrice, maxPrice }}
        />
        <div>
          {result.items.length === 0 ? (
            <EmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử đổi bộ lọc hoặc tìm kiếm với từ khóa khác."
              action={
                <Link href="/tim-kiem" className="nt-btn nt-btn-primary">
                  Tìm kiếm khác
                </Link>
              }
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                basePath={`/danh-muc/${slug}`}
                searchParams={sp}
                currentPage={result.meta.page}
                totalPages={result.meta.totalPages}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
