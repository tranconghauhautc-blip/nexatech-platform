import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatVnd } from '@nexatech/shared-web';
import { Breadcrumbs } from '../../../components/common/breadcrumbs';
import { ProductGallery } from '../../../components/product/product-gallery';
import { ProductPurchasePanel } from '../../../components/product/product-purchase-panel';
import { ProductSpecs } from '../../../components/product/product-specs';
import { ProductReviews } from '../../../components/product/product-reviews';
import { RelatedProducts } from '../../../components/product/related-products';
import { RecentlyViewedTracker } from '../../../components/product/recently-viewed-tracker';
import {
  getProductBySlug,
  getProductPriceRange,
  getRecommendations,
} from '../../../lib/catalog-server';
import styles from './page.module.css';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return { title: 'Không tìm thấy sản phẩm' };
  }
  const range = getProductPriceRange(product);
  return {
    title: product.name,
    description:
      product.description || `${product.name} chính hãng tại NexaTech`,
    alternates: { canonical: `/san-pham/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description || product.name,
      type: 'website',
    },
    other: {
      'product:price:amount': String(range.min),
      'product:price:currency': 'VND',
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const recommendations = await getRecommendations(product.id);
  const range = getProductPriceRange(product);
  const thumbnail =
    product.mediaLinks.find((m) => m.role === 'thumbnail')?.mediaId ??
    product.mediaLinks[0]?.mediaId;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: product.brand.name,
    sku: product.skus[0]?.skuCode,
    description: product.description,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: range.min,
      availability:
        product.status === 'active'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: '/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category.name,
        item: `/danh-muc/${product.category.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `/san-pham/${product.slug}`,
      },
    ],
  };

  return (
    <div className={`nt-container ${styles.root}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <RecentlyViewedTracker
        id={product.id}
        slug={product.slug}
        name={product.name}
        price={range.min}
        thumbnailMediaId={thumbnail}
        brandName={product.brand.name}
      />
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', href: '/' },
          {
            label: product.category.name,
            href: `/danh-muc/${product.category.slug}`,
          },
          { label: product.name },
        ]}
      />
      <div className={styles.grid}>
        <ProductGallery
          mediaLinks={product.mediaLinks}
          productName={product.name}
        />
        <div className={styles.info}>
          <p className={styles.brand}>{product.brand.name}</p>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.price}>
            {formatVnd(range.min)}
            {range.max > range.min ? ` – ${formatVnd(range.max)}` : ''}
          </p>
          {product.description ? (
            <p className={styles.desc}>{product.description}</p>
          ) : null}
          <ProductPurchasePanel product={product} />
        </div>
      </div>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Thông số kỹ thuật</h2>
        <ProductSpecs specValues={product.specValues} />
      </section>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Đánh giá</h2>
        <ProductReviews productId={product.id} />
      </section>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Sản phẩm liên quan</h2>
        <RelatedProducts items={recommendations} />
      </section>
    </div>
  );
}
