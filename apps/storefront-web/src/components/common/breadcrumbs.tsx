import Link from 'next/link';
import styles from './breadcrumbs.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.root}>
      <ol className={styles.list}>
        <li>
          <Link href="/">Trang chủ</Link>
        </li>
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            aria-current={index === items.length - 1 ? 'page' : undefined}
          >
            <span className={styles.separator} aria-hidden="true">
              /
            </span>
            {item.href && index !== items.length - 1 ? (
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
