import { bff } from './api-browser';

export interface OrderItemImageSource {
  imageMediaId?: string | null;
  thumbnailUrl?: string | null;
  mediaId?: string | null;
}

/**
 * Ưu tiên ảnh snapshot lưu trên order item (imageMediaId), sau đó fallback về
 * các tên field cũ nếu backend/mock trả khác (thumbnailUrl, mediaId).
 */
export function resolveOrderItemImage(
  item: OrderItemImageSource,
): string | undefined {
  return item.imageMediaId || item.thumbnailUrl || item.mediaId || undefined;
}

const productThumbnailCache = new Map<string, string | undefined>();
const inFlightProductThumbnail = new Map<string, Promise<string | undefined>>();

/**
 * Đơn hàng cũ (trước khi OrderItem lưu imageMediaId) không có ảnh snapshot.
 * Fallback: tra cứu ảnh đại diện sản phẩm hiện tại theo productId qua BFF
 * catalog, cache theo productId để chỉ gọi một lần cho mỗi sản phẩm.
 */
export function fetchProductThumbnail(
  productId: string,
): Promise<string | undefined> {
  if (productThumbnailCache.has(productId)) {
    return Promise.resolve(productThumbnailCache.get(productId));
  }
  const pending = inFlightProductThumbnail.get(productId);
  if (pending) {
    return pending;
  }
  const promise = bff
    .get<Array<Record<string, unknown>>>(
      `/api/bff/catalog/products/summaries?ids=${encodeURIComponent(productId)}`,
    )
    .then((result) => {
      const summary = Array.isArray(result) ? result[0] : undefined;
      const thumb = summary
        ? String(summary['thumbnailUrl'] ?? '') || undefined
        : undefined;
      productThumbnailCache.set(productId, thumb);
      return thumb;
    })
    .catch(() => {
      productThumbnailCache.set(productId, undefined);
      return undefined;
    })
    .finally(() => {
      inFlightProductThumbnail.delete(productId);
    });
  inFlightProductThumbnail.set(productId, promise);
  return promise;
}
