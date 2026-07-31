'use client';

import { useMemo } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge } from '../../../components/ui/Badge';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'PUBLISHED', label: 'Đã đăng' },
  { value: 'HIDDEN', label: 'Ẩn' },
  { value: 'REJECTED', label: 'Từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'most_reported', label: 'Nhiều báo cáo' },
];

export default function Page() {
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ productId: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'review',
    path: 'admin/reviews',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (r) => String(r['id'] ?? '—').slice(0, 8),
      },
      {
        key: 'productId',
        header: 'Sản phẩm',
        render: (r) => String(r['productId'] ?? '—'),
      },
      {
        key: 'rating',
        header: 'Sao',
        render: (r) => String(r['rating'] ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => <Badge>{String(r['status'] ?? '—')}</Badge>,
      },
      {
        key: 'title',
        header: 'Tiêu đề',
        render: (r) => String(r['title'] ?? r['body'] ?? '—').slice(0, 60),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Đánh giá</div>
          <div className="nx-page-subtitle">Duyệt / ẩn đánh giá khách</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Product ID…"
        searchLabel="Product ID"
        statusValue={controls.status}
        onStatusChange={(v) => {
          controls.setStatus(v);
          controls.setPage(1);
        }}
        statusOptions={STATUS_OPTIONS}
        sortValue={controls.sort}
        onSortChange={(v) => {
          controls.setSort(v);
          controls.setPage(1);
        }}
        sortOptions={SORT_OPTIONS}
        onApply={controls.apply}
        onReset={controls.reset}
      />
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có đánh giá khớp bộ lọc."
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
    </div>
  );
}
