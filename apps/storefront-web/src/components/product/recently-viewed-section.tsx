'use client';

import { formatVnd } from '@nexatech/shared-web';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getRecentlyViewed,
  type RecentlyViewedEntry,
} from '../../lib/recently-viewed';
import { MediaThumb } from '../media/media-thumb';
import styles from './recently-viewed-section.module.css';

export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    setItems(getRecentlyViewed().filter((item) => item.id !== excludeId));
  }, [excludeId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className={styles.root}>
      <h2 className="nt-section-title">Sản phẩm đã xem</h2>
      <div className={styles.row}>
        {items.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={`/san-pham/${item.slug}`}
            className={styles.card}
          >
            <MediaThumb
              mediaRef={item.thumbnailMediaId}
              alt={item.name}
              className={styles.image}
              fallbackLabel={item.name}
            />
            <span className={styles.name}>{item.name}</span>
            <span className={styles.price}>{formatVnd(item.price)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
