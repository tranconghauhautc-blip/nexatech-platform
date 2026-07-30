import Link from 'next/link';
import type { RecommendationItem } from '../../lib/types';
import styles from './related-products.module.css';

export function RelatedProducts({ items }: { items: RecommendationItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/san-pham/${item.slug}`}
          className={styles.card}
        >
          <span className={styles.avatar}>
            {item.name.charAt(0).toUpperCase()}
          </span>
          <span className={styles.name}>{item.name}</span>
        </Link>
      ))}
    </div>
  );
}
