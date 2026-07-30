'use client';

import {
  buildPageNumbers,
  computePaginationState,
  type PaginationMeta,
} from '../../lib/pagination';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const state = computePaginationState(meta);
  if (state.total === 0) {
    return null;
  }
  const pages = buildPageNumbers(state.page, state.totalPages);
  const from = (state.page - 1) * state.pageSize + 1;
  const to = Math.min(state.page * state.pageSize, state.total);

  return (
    <div className="nx-pagination">
      <span className="nx-pagination-info">
        Hiển thị {from}–{to} trong tổng số {state.total}
      </span>
      <button
        type="button"
        className="nx-page-btn"
        disabled={!state.hasPrevious}
        onClick={() => onPageChange(state.page - 1)}
        aria-label="Trang trước"
      >
        ‹
      </button>
      {pages.map((page, index) =>
        page === '...' ? (
          <span
            key={`ellipsis-${index}`}
            className="nx-muted"
            style={{ padding: '0 4px' }}
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            className={`nx-page-btn ${page === state.page ? 'active' : ''}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ),
      )}
      <button
        type="button"
        className="nx-page-btn"
        disabled={!state.hasNext}
        onClick={() => onPageChange(state.page + 1)}
        aria-label="Trang sau"
      >
        ›
      </button>
    </div>
  );
}
