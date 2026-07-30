import Link from 'next/link';
import { formatVnd } from '@nexatech/shared-web';
import { MediaThumb } from '../media/media-thumb';
import type { ProductSearchItem } from '../../lib/types';
import styles from './product-card.module.css';

export function ProductCard({ product }: { product: ProductSearchItem }) {
  const isAvailable = product.status === 'active';

  return (
    <Link href={`/san-pham/${product.slug}`} className={styles.root}>
      <div className={styles.imageWrap}>
        <MediaThumb
          mediaRef={product.thumbnailUrl}
          alt={product.name}
          className={styles.image}
          fallbackLabel={product.name}
        />
        {!isAvailable ? (
          <span className={styles.unavailableBadge}>Ngừng bán</span>
        ) : null}
      </div>
      <div className={styles.body}>
        <span className={styles.brand}>{product.brandName}</span>
        <h3 className={styles.name}>{product.name}</h3>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatVnd(product.minPrice)}</span>
        </div>
      </div>
    </Link>
  );
}
