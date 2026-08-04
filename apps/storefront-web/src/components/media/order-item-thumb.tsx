'use client';

import { useEffect, useState } from 'react';
import {
  fetchProductThumbnail,
  resolveOrderItemImage,
  type OrderItemImageSource,
} from '../../lib/order-item-image';
import { MediaThumb } from './media-thumb';

export interface OrderItemThumbProps {
  item: OrderItemImageSource & { productId?: string | null };
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

/**
 * Ảnh dòng sản phẩm trong đơn hàng. Ưu tiên snapshot lưu trên order item;
 * nếu đơn cũ chưa có snapshot thì tra ảnh đại diện sản phẩm hiện tại theo
 * productId (một lần/sản phẩm, có cache) rồi mới rơi về placeholder.
 */
export function OrderItemThumb({
  item,
  alt,
  className,
  fallbackLabel,
}: OrderItemThumbProps) {
  const direct = resolveOrderItemImage(item);
  const [fallbackRef, setFallbackRef] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (direct || !item.productId) {
      setFallbackRef(undefined);
      return;
    }
    let cancelled = false;
    fetchProductThumbnail(item.productId).then((thumb) => {
      if (!cancelled) {
        setFallbackRef(thumb);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [direct, item.productId]);

  return (
    <MediaThumb
      mediaRef={direct ?? fallbackRef}
      alt={alt}
      className={className}
      fallbackLabel={fallbackLabel}
    />
  );
}
