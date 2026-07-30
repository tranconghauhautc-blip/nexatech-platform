'use client';

import { useState } from 'react';
import { MediaThumb } from '../media/media-thumb';
import type { ProductMediaLink } from '../../lib/types';
import styles from './product-gallery.module.css';

export function ProductGallery({
  mediaLinks,
  productName,
}: {
  mediaLinks: ProductMediaLink[];
  productName: string;
}) {
  const images = [...mediaLinks]
    .filter((link) => link.role !== 'video')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        <MediaThumb
          mediaRef={active?.mediaId}
          alt={productName}
          className={styles.mainImage}
          fallbackLabel={productName}
        />
      </div>
      {images.length > 1 ? (
        <div
          className={styles.thumbRow}
          role="tablist"
          aria-label="Ảnh sản phẩm"
        >
          {images.map((link, index) => (
            <button
              key={link.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex ? styles.thumbActive : styles.thumb
              }
              onClick={() => setActiveIndex(index)}
            >
              <MediaThumb
                mediaRef={link.mediaId}
                alt={`${productName} - ảnh ${index + 1}`}
                className={styles.thumbImage}
                fallbackLabel={productName}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
