import Link from 'next/link';
import styles from './breadcrumbs.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function isHomeCrumb(item: BreadcrumbItem | undefined): boolean {
  if (!item) return false;
  return item.href === '/' || item.label === 'Trang chủ';
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  // Component always renders "Trang chủ"; strip a duplicate leading home crumb from callers.
  const trail = isHomeCrumb(items[0]) ? items.slice(1) : items;

  return (
    <nav aria-label="Breadcrumb" className={styles.root}>
      <ol className={styles.list}>
        <li>
          <Link href="/">Trang chủ</Link>
        </li>
        {trail.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            aria-current={index === trail.length - 1 ? 'page' : undefined}
          >
            <span className={styles.separator} aria-hidden="true">
              /
            </span>
            {item.href && index !== trail.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span className={styles.current}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
