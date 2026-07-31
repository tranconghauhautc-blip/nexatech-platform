import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '../../components/product/product-grid';
import { EmptyState } from '../../components/common/empty-state';
import { Pagination } from '../../components/common/pagination';
import { ProductFilters } from '../../components/catalog/product-filters';
import { searchProducts } from '../../lib/catalog-server';

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

  const result = await searchProducts({
    q,
    page,
    pageSize: 12,
    sort,
    brandSlug,
    categorySlug,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

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
          current={{ q, brandSlug, sort, page, minPrice, maxPrice }}
          reflectHtml={q || undefined}
        />
        <div>
          {result.items.length === 0 ? (
            <EmptyState
              title="Không có kết quả"
              description="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
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
