import styles from './states.module.css';

export function LoadingState({
  label = 'Đang tải dữ liệu...',
}: {
  label?: string;
}) {
  return (
    <div className={styles.spinnerRow} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden />
      <span className="nx-visually-hidden">{label}</span>
    </div>
  );
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.wrapper} role="status">
      <div className={styles.icon} aria-hidden>
        🗂️
      </div>
      <div className={styles.title}>{title}</div>
      {description ? (
        <div className={styles.description}>{description}</div>
      ) : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorWrapper} role="alert">
      <div className={styles.icon} aria-hidden>
        ⚠️
      </div>
      <div className={styles.title}>{title}</div>
      {description ? (
        <div className={styles.description}>{description}</div>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          className="nx-btn nx-btn-secondary"
          onClick={onRetry}
        >
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
