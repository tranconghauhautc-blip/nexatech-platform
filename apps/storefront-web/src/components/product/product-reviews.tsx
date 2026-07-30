import Link from 'next/link';
import type {
  PaginatedResponse,
  ProductRatingSummaryDto,
  ReviewDto,
} from '@nexatech/shared-contracts';
import { formatDateVn } from '@nexatech/shared-web';
import { serverApiRequest } from '../../lib/api-server';
import { RatingStars } from './rating-stars';
import styles from './product-reviews.module.css';

async function getSummary(
  productId: string,
): Promise<ProductRatingSummaryDto | null> {
  try {
    return await serverApiRequest<ProductRatingSummaryDto>(
      'review',
      `/products/${productId}/reviews/summary`,
    );
  } catch {
    return null;
  }
}

async function getReviews(
  productId: string,
): Promise<PaginatedResponse<ReviewDto>> {
  try {
    return await serverApiRequest<PaginatedResponse<ReviewDto>>(
      'review',
      `/products/${productId}/reviews`,
      { query: { page: 1, pageSize: 5, sort: 'newest' } },
    );
  } catch {
    return {
      items: [],
      meta: { page: 1, pageSize: 5, totalItems: 0, totalPages: 1 },
    };
  }
}

export async function ProductReviews({ productId }: { productId: string }) {
  const [summary, reviews] = await Promise.all([
    getSummary(productId),
    getReviews(productId),
  ]);

  const counts = summary?.ratingCounts;
  const total = summary?.totalReviews ?? 0;

  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <div className={styles.summaryScore}>
          <span className={styles.scoreValue}>
            {(summary?.averageRating ?? 0).toFixed(1)}
          </span>
          <RatingStars rating={summary?.averageRating ?? 0} size={18} />
          <span className="nt-muted">{total} đánh giá</span>
        </div>
        {counts ? (
          <div className={styles.bars}>
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = counts[`star${star}` as keyof typeof counts] ?? 0;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={star} className={styles.barRow}>
                  <span>{star} sao</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className={styles.barCount}>{count}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={styles.list}>
        {reviews.items.length === 0 ? (
          <p className="nt-muted">Chưa có đánh giá nào cho sản phẩm này.</p>
        ) : (
          reviews.items.map((review) => (
            <article key={review.id} className={styles.item}>
              <div className={styles.itemHead}>
                <RatingStars rating={review.rating} size={14} />
                <span className={styles.itemAuthor}>{review.displayName}</span>
                {review.verifiedPurchase ? (
                  <span className="nt-badge nt-badge--success">
                    Đã mua hàng
                  </span>
                ) : null}
                <span className={styles.itemDate}>
                  {formatDateVn(review.createdAt)}
                </span>
              </div>
              {review.title ? (
                <h4 className={styles.itemTitle}>{review.title}</h4>
              ) : null}
              <p className={styles.itemContent}>{review.content}</p>
              {review.reply ? (
                <div className={styles.reply}>
                  <strong>Phản hồi từ NexaTech:</strong> {review.reply.content}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
      <p className="nt-muted">
        Chỉ khách hàng đã mua và nhận sản phẩm mới có thể viết đánh giá — xem
        trong <Link href="/tai-khoan/don-hang">Đơn hàng của tôi</Link>.
      </p>
    </div>
  );
}
