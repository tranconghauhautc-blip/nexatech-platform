import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const w = (rel, c) => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, c.replace(/\r\n/g, '\n'));
  console.log(rel);
};

w(
  'apps/storefront-web/src/app/san-pham/[slug]/page.tsx',
  `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '../../../components/common/breadcrumbs';
import { ProductGallery } from '../../../components/product/product-gallery';
import { ProductPurchasePanel } from '../../../components/product/product-purchase-panel';
import { ProductSpecs } from '../../../components/product/product-specs';
import { ProductReviews } from '../../../components/product/product-reviews';
import { RelatedProducts } from '../../../components/product/related-products';
import { RecentlyViewedTracker } from '../../../components/product/recently-viewed-tracker';
import { RatingStars } from '../../../components/product/rating-stars';
import {
  getProductBySlug,
  getProductPriceRange,
  getRecommendations,
  getStockAvailability,
} from '../../../lib/catalog-server';
import { formatVnd } from '@nexatech/shared-web';
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
    description: product.shortDescription || \`\${product.name} chính hãng tại NexaTech\`,
    alternates: { canonical: \`/san-pham/\${product.slug}\` },
    openGraph: {
      title: product.name,
      description: product.shortDescription || product.name,
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

  const [recommendations, stock] = await Promise.all([
    getRecommendations(product.id),
    product.skus[0]?.skuCode
      ? getStockAvailability(product.skus[0].skuCode, 1)
      : Promise.resolve([]),
  ]);
  const range = getProductPriceRange(product);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: product.brandName,
    sku: product.skus[0]?.skuCode,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: range.min,
      availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: '/' },
      { '@type': 'ListItem', position: 2, name: product.categoryName || product.categorySlug, item: \`/danh-muc/\${product.categorySlug}\` },
      { '@type': 'ListItem', position: 3, name: product.name, item: \`/san-pham/\${product.slug}\` },
    ],
  };

  return (
    <div className={\`nt-container \${styles.root}\`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <RecentlyViewedTracker productId={product.id} slug={product.slug} name={product.name} />
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: product.categoryName || product.categorySlug, href: \`/danh-muc/\${product.categorySlug}\` },
          { label: product.name },
        ]}
      />
      <div className={styles.grid}>
        <ProductGallery media={product.media ?? []} productName={product.name} />
        <div className={styles.info}>
          <p className={styles.brand}>{product.brandName}</p>
          <h1 className={styles.title}>{product.name}</h1>
          <div className={styles.ratingRow}>
            <RatingStars value={product.ratingAverage ?? 0} />
            <span className={styles.ratingText}>
              {(product.ratingAverage ?? 0).toFixed(1)} · {product.ratingCount ?? 0} đánh giá
            </span>
          </div>
          <p className={styles.price}>{formatVnd(range.min)}{range.max > range.min ? \` – \${formatVnd(range.max)}\` : ''}</p>
          {product.shortDescription ? <p className={styles.desc}>{product.shortDescription}</p> : null}
          <ProductPurchasePanel product={product} stock={stock} />
        </div>
      </div>
      <ProductSpecs specs={product.specs ?? []} />
      <ProductReviews productId={product.id} />
      <RelatedProducts items={recommendations} />
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/san-pham/[slug]/page.module.css',
  `.root { padding: 1.5rem 0 3rem; }
.grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; margin-top: 1rem; }
.info { display: flex; flex-direction: column; gap: 0.75rem; }
.brand { margin: 0; color: #0284c7; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.8rem; }
.title { margin: 0; font-family: var(--font-space-grotesk), sans-serif; color: #0b1f3a; font-size: clamp(1.5rem, 3vw, 2rem); }
.ratingRow { display: flex; align-items: center; gap: 0.5rem; }
.ratingText { color: #4b6478; font-size: 0.9rem; }
.price { margin: 0; font-size: 1.5rem; font-weight: 700; color: #0b1f3a; }
.desc { margin: 0; color: #334155; line-height: 1.6; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
`,
);

w(
  'apps/storefront-web/src/app/gio-hang/page.tsx',
  `'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { useCart } from '../../components/providers/cart-provider';
import { EmptyState } from '../../components/common/empty-state';
import { getErrorMessage } from '../../lib/api-browser';
import styles from './page.module.css';

export default function CartPage() {
  const { cart, loading, error, refresh, updateItem, removeItem, validate, validating } = useCart();
  const [actionError, setActionError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onValidate() {
    setActionError(null);
    try {
      const result = await validate();
      const nextIssues = (result?.issues ?? []).map((issue) => issue.message || issue.code);
      setIssues(nextIssues);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  if (loading && !cart) {
    return <div className="nt-container nt-skeleton" style={{ margin: '2rem auto', minHeight: 200 }} aria-busy="true" aria-label="Đang tải giỏ hàng" />;
  }

  if (error) {
    return (
      <div className="nt-container" style={{ padding: '2rem 0' }}>
        <EmptyState title="Không tải được giỏ hàng" description={error} actionLabel="Thử lại" onAction={() => void refresh()} />
      </div>
    );
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="nt-container" style={{ padding: '2rem 0' }}>
        <EmptyState title="Giỏ hàng trống" description="Hãy thêm sản phẩm từ trang danh mục." actionHref="/tim-kiem" actionLabel="Tiếp tục mua sắm" />
      </div>
    );
  }

  return (
    <div className={\`nt-container \${styles.root}\`}>
      <h1 className={styles.title}>Giỏ hàng</h1>
      {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}
      {issues.length > 0 ? (
        <ul className={styles.issues} aria-live="polite">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.skuId || item.skuCode} className={styles.item}>
            <div>
              <div className={styles.name}>{item.productName || item.skuCode}</div>
              <div className={styles.meta}>{item.skuCode}</div>
              {item.priceChanged ? <div className={styles.warn}>Giá đã thay đổi so với lúc thêm vào giỏ</div> : null}
            </div>
            <div className={styles.qty}>
              <label htmlFor={\`qty-\${item.skuId}\`}>Số lượng</label>
              <input
                id={\`qty-\${item.skuId}\`}
                type="number"
                min={1}
                max={99}
                defaultValue={item.quantity}
                onBlur={async (event) => {
                  const quantity = Number(event.target.value);
                  if (!Number.isFinite(quantity) || quantity < 1) return;
                  try {
                    await updateItem(item.skuId, quantity);
                  } catch (err) {
                    setActionError(getErrorMessage(err));
                  }
                }}
              />
            </div>
            <div className={styles.price}>{formatVnd((item.unitPrice ?? 0) * item.quantity)}</div>
            <button
              type="button"
              className={styles.remove}
              onClick={async () => {
                try {
                  await removeItem(item.skuId);
                } catch (err) {
                  setActionError(getErrorMessage(err));
                }
              }}
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.summary}>
        <div>
          <div className={styles.subtotalLabel}>Tạm tính (hiển thị)</div>
          <div className={styles.subtotal}>{formatVnd(cart?.subtotal ?? items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0))}</div>
          <p className={styles.note}>Tổng thanh toán cuối cùng do máy chủ tính khi checkout. Không áp dụng voucher.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="nt-btn nt-btn-ghost" disabled={validating} onClick={() => void onValidate()}>
            {validating ? 'Đang kiểm tra…' : 'Kiểm tra tồn kho & giá'}
          </button>
          <Link href="/thanh-toan" className="nt-btn nt-btn-primary">Tiến hành thanh toán</Link>
        </div>
      </div>
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/gio-hang/page.module.css',
  `.root { padding: 1.5rem 0 3rem; }
.title { font-family: var(--font-space-grotesk), sans-serif; color: #0b1f3a; }
.list { list-style: none; padding: 0; margin: 1.25rem 0; display: flex; flex-direction: column; gap: 0.85rem; }
.item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid #dbeafe; border-radius: 12px; background: #fff; }
.name { font-weight: 600; color: #0b1f3a; }
.meta { color: #64748b; font-size: 0.85rem; }
.warn { color: #b45309; font-size: 0.85rem; margin-top: 0.25rem; }
.qty { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
.qty input { width: 72px; padding: 0.35rem 0.5rem; border-radius: 8px; border: 1px solid #cbd5e1; }
.price { font-weight: 700; color: #0b1f3a; }
.remove { border: none; background: transparent; color: #b91c1c; cursor: pointer; font: inherit; }
.summary { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 1.25rem; border-radius: 14px; background: #0b1f3a; color: #e0f2fe; }
.subtotalLabel { opacity: 0.8; }
.subtotal { font-size: 1.5rem; font-weight: 700; }
.note { margin: 0.5rem 0 0; font-size: 0.85rem; opacity: 0.8; max-width: 28rem; }
.actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.error { color: #b91c1c; }
.issues { background: #fff7ed; color: #9a3412; padding: 0.85rem 1rem; border-radius: 10px; }
@media (max-width: 720px) { .item { grid-template-columns: 1fr; } }
`,
);

console.log('pdp+cart ok');
