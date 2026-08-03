import Link from 'next/link';
import type { Metadata } from 'next';
import { ProductGrid } from '../components/product/product-grid';
import { RecentlyViewedSection } from '../components/product/recently-viewed-section';
import { EmptyState } from '../components/common/empty-state';
import { SITE_DESCRIPTION, SITE_NAME } from '../lib/constants';
import { loadNavCategories } from '../lib/categories';
import { getBrands, searchProducts } from '../lib/catalog-server';
import styles from './home.module.css';

export const metadata: Metadata = {
  title: `${SITE_NAME} — Công nghệ chính hãng`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

export const revalidate = 60;

export default async function HomePage() {
  const [newest, brands, nav] = await Promise.all([
    searchProducts({ sort: 'newest', page: 1, pageSize: 8 }),
    getBrands(),
    loadNavCategories(),
  ]);

  const { categories, error: categoriesError } = nav;
  const featuredHref =
    categories.length > 0 ? `/danh-muc/${categories[0].slug}` : '/tim-kiem';

  return (
    <div className={styles.root}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`nt-container ${styles.heroInner}`}>
          <div className={styles.heroBrand}>
            <span className={styles.heroMark} aria-hidden="true">
              N
            </span>
            <p className={styles.eyebrow}>NexaTech</p>
          </div>
          <h1 id="hero-title" className={styles.heroTitle}>
            Công nghệ chính hãng cho mọi nhu cầu
          </h1>
          <p className={styles.heroLead}>
            Thiết bị công nghệ chính hãng — giao nhanh toàn quốc, hỗ trợ bảo
            hành rõ ràng.
          </p>
          <div className={styles.heroActions}>
            <Link href={featuredHref} className="nt-btn nt-btn-primary">
              {categories.length > 0
                ? `Khám phá ${categories[0].label}`
                : 'Khám phá sản phẩm'}
            </Link>
            <Link href="/tim-kiem" className="nt-btn nt-btn-ghost">
              Tìm sản phẩm
            </Link>
          </div>
        </div>
      </section>

      <section
        className={`nt-container ${styles.section}`}
        aria-labelledby="cat-title"
      >
        <h2 id="cat-title" className={styles.sectionTitle}>
          Danh mục nổi bật
        </h2>
        <p className={styles.sectionLead}>
          Chọn danh mục phù hợp với nhu cầu của bạn.
        </p>
        <div className={styles.categoryGrid}>
          {categories.length > 0 ? (
            categories.map((category) => (
              <Link
                key={category.slug}
                href={`/danh-muc/${category.slug}`}
                className={styles.categoryCard}
              >
                <span className={styles.categoryLabel}>{category.label}</span>
              </Link>
            ))
          ) : (
            <EmptyState
              title={
                categoriesError ? 'Không tải được danh mục' : 'Chưa có danh mục'
              }
              description={
                categoriesError
                  ? 'Catalog tạm thời không phản hồi. Vui lòng thử lại sau.'
                  : 'Danh mục sẽ hiển thị khi catalog được cập nhật.'
              }
              action={
                <Link href="/tim-kiem" className="nt-btn nt-btn-primary">
                  Tìm sản phẩm
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section
        className={`nt-container ${styles.section}`}
        aria-labelledby="new-title"
      >
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="new-title" className={styles.sectionTitle}>
              Sản phẩm mới
            </h2>
            <p className={styles.sectionLead}>
              Cập nhật liên tục từ catalog NexaTech.
            </p>
          </div>
          <Link href="/tim-kiem?sort=newest" className={styles.sectionLink}>
            Xem tất cả
          </Link>
        </div>
        {newest.items.length > 0 ? (
          <ProductGrid products={newest.items} />
        ) : (
          <EmptyState
            title="Chưa có sản phẩm"
            description="Catalog đang được cập nhật. Vui lòng quay lại sau."
          />
        )}
      </section>

      <section
        className={`nt-container ${styles.section}`}
        aria-labelledby="brand-title"
      >
        <h2 id="brand-title" className={styles.sectionTitle}>
          Thương hiệu
        </h2>
        <p className={styles.sectionLead}>Đối tác công nghệ uy tín.</p>
        {brands.length > 0 ? (
          <ul className={styles.brandList}>
            {brands.map((brand) => (
              <li key={brand.id}>
                <Link
                  href={`/tim-kiem?brandSlug=${encodeURIComponent(brand.slug)}`}
                  className={styles.brandChip}
                >
                  {brand.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Chưa có thương hiệu"
            description="Dữ liệu thương hiệu sẽ hiển thị khi catalog sẵn sàng."
          />
        )}
      </section>

      <section className={`nt-container ${styles.section}`}>
        <RecentlyViewedSection />
      </section>
    </div>
  );
}
