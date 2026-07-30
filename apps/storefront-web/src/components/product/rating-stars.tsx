import styles from './rating-stars.module.css';

export function RatingStars({
  rating,
  size = 16,
  showValue = false,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(rating * 2) / 2;

  return (
    <span
      className={styles.root}
      role="img"
      aria-label={`${rating.toFixed(1)} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent =
          Math.max(0, Math.min(1, rounded - (star - 1))) * 100;
        return (
          <span
            key={star}
            className={styles.starWrap}
            style={{ width: size, height: size }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              className={styles.starBase}
            >
              <path
                fill="currentColor"
                d="M12 2.5l2.9 6.1 6.7.7-5 4.6 1.4 6.6L12 17l-6 3.5 1.4-6.6-5-4.6 6.7-.7L12 2.5z"
              />
            </svg>
            <span
              className={styles.starFillClip}
              style={{ width: `${fillPercent}%` }}
            >
              <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                className={styles.starFill}
              >
                <path
                  fill="currentColor"
                  d="M12 2.5l2.9 6.1 6.7.7-5 4.6 1.4 6.6L12 17l-6 3.5 1.4-6.6-5-4.6 6.7-.7L12 2.5z"
                />
              </svg>
            </span>
          </span>
        );
      })}
      {showValue ? (
        <span className={styles.value}>{rating.toFixed(1)}</span>
      ) : null}
    </span>
  );
}
