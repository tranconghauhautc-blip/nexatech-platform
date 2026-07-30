import {
  applyAggregateContribution,
  averageRating,
  averageRatingCents,
  emptyAggregate,
  rebuildFromPublished,
} from './aggregate';

describe('rating aggregate math', () => {
  it('computes average with integer cents rounding', () => {
    expect(averageRatingCents(14, 3)).toBe(467); // 4.666... → 4.67
    expect(averageRating(14, 3)).toBe(4.67);
    expect(averageRatingCents(0, 0)).toBe(0);
  });

  it('applies add/remove contributions safely', () => {
    let agg = emptyAggregate('p1');
    agg = applyAggregateContribution(
      agg,
      { rating: 5, verified: true, hasMedia: true },
      1,
    );
    agg = applyAggregateContribution(
      agg,
      { rating: 4, verified: true, hasMedia: false },
      1,
    );
    expect(agg.totalReviews).toBe(2);
    expect(agg.sumRating).toBe(9);
    expect(agg.star5).toBe(1);
    expect(agg.star4).toBe(1);
    expect(agg.verifiedReviews).toBe(2);
    expect(agg.mediaReviews).toBe(1);

    agg = applyAggregateContribution(
      agg,
      { rating: 5, verified: true, hasMedia: true },
      -1,
    );
    expect(agg.totalReviews).toBe(1);
    expect(agg.sumRating).toBe(4);
    expect(agg.star5).toBe(0);
  });

  it('rebuilds from published reviews', () => {
    const agg = rebuildFromPublished('p1', [
      { rating: 5, verifiedPurchase: true, hasMedia: false },
      { rating: 3, verifiedPurchase: true, hasMedia: true },
    ]);
    expect(agg.totalReviews).toBe(2);
    expect(agg.sumRating).toBe(8);
    expect(averageRatingCents(agg.sumRating, agg.totalReviews)).toBe(400);
  });
});
