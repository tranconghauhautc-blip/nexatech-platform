export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginationState extends PaginationMeta {
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** Chuẩn hóa dữ liệu phân trang trả về từ backend thành trạng thái UI dùng chung. */
export function computePaginationState(meta: PaginationMeta): PaginationState {
  const page = Math.max(1, Math.trunc(meta.page) || 1);
  const pageSize = Math.max(1, Math.trunc(meta.pageSize) || 1);
  const total = Math.max(0, Math.trunc(meta.total) || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

const MAX_VISIBLE_PAGES = 7;

/**
 * Sinh danh sách số trang hiển thị trên thanh phân trang, có dấu `'...'` khi
 * số trang vượt quá `MAX_VISIBLE_PAGES`. Ví dụ: [1, '...', 4, 5, 6, '...', 20].
 */
export function buildPageNumbers(
  current: number,
  totalPages: number,
): Array<number | '...'> {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, current]);
  pages.add(Math.max(1, current - 1));
  pages.add(Math.min(totalPages, current + 1));

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: Array<number | '...'> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous !== 0 && page - previous > 1) {
      result.push('...');
    }
    result.push(page);
    previous = page;
  }
  return result;
}

/** Đọc `page`/`pageSize` từ URLSearchParams với giá trị mặc định an toàn. */
export function parsePaginationParams(
  params: URLSearchParams,
  defaults: { page?: number; pageSize?: number } = {},
): { page: number; pageSize: number } {
  const rawPage = Number(params.get('page'));
  const rawPageSize = Number(params.get('pageSize'));
  const page =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.trunc(rawPage)
      : (defaults.page ?? 1);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(100, Math.trunc(rawPageSize))
      : (defaults.pageSize ?? 20);
  return { page, pageSize };
}
