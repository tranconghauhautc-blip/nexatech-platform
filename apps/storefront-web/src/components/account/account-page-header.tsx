import Link from 'next/link';
import styles from './account-page-header.module.css';

export function AccountPageHeader({
  title,
  description,
  backHref,
  backLabel = 'Quay lại',
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      {backHref ? (
        <Link href={backHref} className={styles.back}>
          ← {backLabel}
        </Link>
      ) : null}
      <div className={styles.row}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.desc}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
