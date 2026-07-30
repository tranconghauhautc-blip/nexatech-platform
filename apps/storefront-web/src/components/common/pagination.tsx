import Link from 'next/link';
import styles from './pagination.module.css';

export interface PaginationProps {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  currentPage: number;
  totalPages: number;
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page' || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  searchParams,
  currentPage,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1,
  );

  const items: (number | 'ellipsis')[] = [];
  let previous = 0;
  for (const page of pages) {
    if (previous && page - previous > 1) {
      items.push('ellipsis');
    }
    items.push(page);
    previous = page;
  }

  return (
    <nav className={styles.root} aria-label="Phân trang">
      <Link
        href={buildHref(basePath, searchParams, Math.max(1, currentPage - 1))}
        className={styles.navBtn}
        aria-disabled={currentPage === 1}
        aria-label="Trang trước"
      >
        ‹
      </Link>
      {items.map((item, index) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis}>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(basePath, searchParams, item)}
            className={item === currentPage ? styles.pageActive : styles.page}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </Link>
        ),
      )}
      <Link
        href={buildHref(
          basePath,
          searchParams,
          Math.min(totalPages, currentPage + 1),
        )}
        className={styles.navBtn}
        aria-disabled={currentPage === totalPages}
        aria-label="Trang sau"
      >
        ›
      </Link>
    </nav>
  );
}
