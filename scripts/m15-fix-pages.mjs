import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(rel);
}

// Home
w(
  'apps/storefront-web/src/app/page.tsx',
  `import Link from 'next/link';
import type { Metadata } from 'next';
import { ProductGrid } from '../components/product/product-grid';
import { RecentlyViewedSection } from '../components/product/recently-viewed-section';
import { EmptyState } from '../components/common/empty-state';
import { NAV_CATEGORIES, SITE_DESCRIPTION, SITE_NAME } from '../lib/constants';
import { getBrands, searchProducts } from '../lib/catalog-server';
import styles from './home.module.css';

export const metadata: Metadata = {
  title: \`\${SITE_NAME} — Công nghệ chính hãng\`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

export const revalidate = 60;

export default async function HomePage() {
  const [newest, brands] = await Promise.all([
    searchProducts({ sort: 'newest', page: 1, pageSize: 8 }),
    getBrands(),
  ]);

  return (
    <div className={styles.root}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={\`nt-container \${styles.heroInner}\`}>
          <p className={styles.eyebrow}>NexaTech</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Công nghệ chính hãng cho mọi nhu cầu
          </h1>
          <p className={styles.heroLead}>
            Điện thoại, laptop, tablet, đồng hồ thông minh, tai nghe &amp; loa và phụ kiện —
            giao nhanh toàn quốc, hỗ trợ bảo hành rõ ràng.
          </p>
          <div className={styles.heroActions}>
            <Link href="/danh-muc/dien-thoai" className="nt-btn nt-btn-primary">
              Khám phá điện thoại
            </Link>
            <Link href="/tim-kiem" className="nt-btn nt-btn-ghost">
              Tìm sản phẩm
            </Link>
          </div>
        </div>
      </section>

      <section className={\`nt-container \${styles.section}\`} aria-labelledby="cat-title">
        <h2 id="cat-title" className={styles.sectionTitle}>Danh mục nổi bật</h2>
        <p className={styles.sectionLead}>Chọn danh mục phù hợp với nhu cầu của bạn.</p>
        <div className={styles.categoryGrid}>
          {NAV_CATEGORIES.map((category) => (
            <Link key={category.slug} href={\`/danh-muc/\${category.slug}\`} className={styles.categoryCard}>
              <span className={styles.categoryLabel}>{category.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={\`nt-container \${styles.section}\`} aria-labelledby="new-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="new-title" className={styles.sectionTitle}>Sản phẩm mới</h2>
            <p className={styles.sectionLead}>Cập nhật liên tục từ catalog NexaTech.</p>
          </div>
          <Link href="/tim-kiem?sort=newest" className={styles.sectionLink}>Xem tất cả</Link>
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

      <section className={\`nt-container \${styles.section}\`} aria-labelledby="brand-title">
        <h2 id="brand-title" className={styles.sectionTitle}>Thương hiệu</h2>
        <p className={styles.sectionLead}>Đối tác công nghệ uy tín.</p>
        {brands.length > 0 ? (
          <ul className={styles.brandList}>
            {brands.map((brand) => (
              <li key={brand.id}>
                <Link href={\`/tim-kiem?brandSlug=\${encodeURIComponent(brand.slug)}\`} className={styles.brandChip}>
                  {brand.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Chưa có thương hiệu" description="Dữ liệu thương hiệu sẽ hiển thị khi catalog sẵn sàng." />
        )}
      </section>

      <section className={\`nt-container \${styles.section}\`}>
        <RecentlyViewedSection />
      </section>
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/home.module.css',
  fs
    .readFileSync(path.join(root, 'scripts/m15-pages.mjs'), 'utf8')
    .includes('hero')
    ? undefined
    : '',
);

// Fix: write home css properly
w(
  'apps/storefront-web/src/app/home.module.css',
  `.root { display: flex; flex-direction: column; gap: 0; }
.hero {
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(0, 180, 216, 0.28), transparent 60%),
    linear-gradient(135deg, #071628 0%, #0b1f3a 45%, #123456 100%);
  color: #f4fbff;
  padding: 4.5rem 0 4rem;
}
.heroInner { max-width: 720px; }
.eyebrow {
  font-family: var(--font-space-grotesk), sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: #7dd3fc;
  margin: 0 0 1rem;
}
.heroTitle {
  font-family: var(--font-space-grotesk), sans-serif;
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 1.1;
  margin: 0 0 1rem;
}
.heroLead { margin: 0 0 1.75rem; color: #c7e8f5; max-width: 40rem; }
.heroActions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.section { padding: 3rem 0; }
.sectionHeader { display: flex; justify-content: space-between; gap: 1rem; align-items: end; margin-bottom: 1.25rem; }
.sectionTitle { font-family: var(--font-space-grotesk), sans-serif; font-size: 1.5rem; margin: 0 0 0.35rem; color: #0b1f3a; }
.sectionLead { margin: 0; color: #4b6478; }
.sectionLink { color: #0284c7; font-weight: 600; text-decoration: none; }
.categoryGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.85rem;
  margin-top: 1.25rem;
}
.categoryCard {
  display: flex; align-items: center; justify-content: center; min-height: 96px; padding: 1rem;
  border-radius: 14px; text-decoration: none; color: #0b1f3a; font-weight: 600;
  background: linear-gradient(160deg, #f0f9ff, #e0f2fe); border: 1px solid #bae6fd;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.categoryCard:hover, .categoryCard:focus-visible {
  transform: translateY(-2px); box-shadow: 0 10px 24px rgba(2, 132, 199, 0.15); outline: none;
}
.categoryLabel { text-align: center; }
.brandList { list-style: none; display: flex; flex-wrap: wrap; gap: 0.65rem; padding: 0; margin: 1.25rem 0 0; }
.brandChip {
  display: inline-flex; padding: 0.55rem 0.9rem; border-radius: 999px;
  background: #0b1f3a; color: #e0f2fe; text-decoration: none; font-size: 0.9rem;
}
.brandChip:hover, .brandChip:focus-visible { background: #0369a1; outline: none; }
@media (max-width: 720px) {
  .hero { padding: 3rem 0 2.5rem; }
  .sectionHeader { flex-direction: column; align-items: start; }
}
`,
);

console.log('home rewritten');
