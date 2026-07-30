import type { ProductRatingAggregateRecord } from './review.types';

export function emptyAggregate(
  productId: string,
  now = new Date(),
): ProductRatingAggregateRecord {
  return {
    productId,
    sumRating: 0,
    totalReviews: 0,
    verifiedReviews: 0,
    mediaReviews: 0,
    star1: 0,
    star2: 0,
    star3: 0,
    star4: 0,
    star5: 0,
    version: 0,
    updatedAt: now,
  };
}

function starKey(
  rating: number,
): keyof Pick<
  ProductRatingAggregateRecord,
  'star1' | 'star2' | 'star3' | 'star4' | 'star5'
> {
  return `star${rating}` as 'star1' | 'star2' | 'star3' | 'star4' | 'star5';
}

export function applyAggregateContribution(
  agg: ProductRatingAggregateRecord,
  contribution: { rating: number; verified: boolean; hasMedia: boolean },
  sign: 1 | -1,
): ProductRatingAggregateRecord {
  const next = { ...agg };
  next.sumRating += sign * contribution.rating;
  next.totalReviews += sign;
  if (contribution.verified) {
    next.verifiedReviews += sign;
  }
  if (contribution.hasMedia) {
    next.mediaReviews += sign;
  }
  const key = starKey(contribution.rating);
  next[key] += sign;
  // Clamp floors to zero for safety after rebuild/edit races
  next.sumRating = Math.max(0, next.sumRating);
  next.totalReviews = Math.max(0, next.totalReviews);
  next.verifiedReviews = Math.max(0, next.verifiedReviews);
  next.mediaReviews = Math.max(0, next.mediaReviews);
  next.star1 = Math.max(0, next.star1);
  next.star2 = Math.max(0, next.star2);
  next.star3 = Math.max(0, next.star3);
  next.star4 = Math.max(0, next.star4);
  next.star5 = Math.max(0, next.star5);
  next.version += 1;
  next.updatedAt = new Date();
  return next;
}

/** averageRatingCents = round(sumRating * 100 / total); average = cents / 100 */
export function averageRatingCents(
  sumRating: number,
  totalReviews: number,
): number {
  if (totalReviews <= 0) {
    return 0;
  }
  return Math.round((sumRating * 100) / totalReviews);
}

export function averageRating(sumRating: number, totalReviews: number): number {
  return averageRatingCents(sumRating, totalReviews) / 100;
}

export function rebuildFromPublished(
  productId: string,
  reviews: Array<{
    rating: number;
    verifiedPurchase: boolean;
    hasMedia: boolean;
  }>,
): ProductRatingAggregateRecord {
  let agg = emptyAggregate(productId);
  for (const review of reviews) {
    agg = applyAggregateContribution(
      agg,
      {
        rating: review.rating,
        verified: review.verifiedPurchase,
        hasMedia: review.hasMedia,
      },
      1,
    );
  }
  agg.version = 0;
  return agg;
}
