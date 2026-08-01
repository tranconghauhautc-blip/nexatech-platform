import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '../../components/product/product-grid';
import { EmptyState } from '../../components/common/empty-state';
import { Pagination } from '../../components/common/pagination';
import { ProductFilters } from '../../components/catalog/product-filters';
import {
  flattenCategories,
  getCategoryTree,
  getProductFacets,
  searchProducts,
} from '../../lib/catalog-server';
import { NAV_CATEGORIES } from '../../lib/constants';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const q = first(sp['q']) ?? '';
  const page = Number(first(sp['page']) ?? '1') || 1;
  const sort =
    (first(sp['sort']) as
      | 'newest'
      | 'price_asc'
      | 'price_desc'
      | 'name'
      | 'relevance') || 'relevance';
  const brandSlug = first(sp['brandSlug']);
  const categorySlug = first(sp['categorySlug']);
  const minPrice = first(sp['minPrice']);
  const maxPrice = first(sp['maxPrice']);

  const listQuery = {
    q,
    page,
    pageSize: 12,
    sort,
    brandSlug,
    categorySlug,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  };

  const [result, facets, tree] = await Promise.all([
    searchProducts(listQuery),
    getProductFacets({
      q,
      categorySlug,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    }),
    getCategoryTree(),
  ]);

  const categoriesFromApi = flattenCategories(tree).map((node) => ({
    slug: node.slug,
    name: node.name,
  }));
  const categories =
    categoriesFromApi.length > 0
      ? categoriesFromApi
      : NAV_CATEGORIES.map((c) => ({ slug: c.slug, name: c.label }));

  return (
    <div className="nt-container" style={{ padding: '1.5rem 0 3rem' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
        {q ? `Kết quả cho “${q}”` : 'Tìm kiếm sản phẩm'}
      </h1>
      <p style={{ color: '#4b6478' }}>
        {result.meta.totalItems} sản phẩm phù hợp
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px,240px) 1fr',
          gap: '1.5rem',
          marginTop: '1.25rem',
        }}
      >
        <ProductFilters
          basePath="/tim-kiem"
          brandFacets={facets.brands}
          priceRange={facets.priceRange}
          categories={categories}
          current={{
            q,
            brandSlug,
            categorySlug,
            sort,
            page,
            minPrice,
            maxPrice,
          }}
          reflectHtml={q || undefined}
        />
        <div>
          {result.items.length === 0 ? (
            <EmptyState
              title="Không có kết quả"
              description="Thử từ khóa hoặc bộ lọc khác."
              action={
                <Link href="/" className="nt-btn nt-btn-primary">
                  Về trang chủ
                </Link>
              }
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                basePath="/tim-kiem"
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
