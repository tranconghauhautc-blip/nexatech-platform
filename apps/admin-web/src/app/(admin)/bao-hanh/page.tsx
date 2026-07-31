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
  { value: 'SUBMITTED', label: 'Đã gửi' },
  { value: 'IN_REVIEW', label: 'Đang xét' },
  { value: 'APPROVED', label: 'Duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Hủy' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

export default function Page() {
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ orderId: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'warranty',
    path: 'admin/warranty/claims',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Claim',
        render: (r) => String(r['id'] ?? '—').slice(0, 8),
      },
      {
        key: 'orderId',
        header: 'Đơn',
        render: (r) => String(r['orderId'] ?? '—'),
      },
      {
        key: 'customerId',
        header: 'Khách',
        render: (r) => String(r['customerId'] ?? '—').slice(0, 8),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => <Badge>{String(r['status'] ?? '—')}</Badge>,
      },
      {
        key: 'reason',
        header: 'Lý do',
        render: (r) => String(r['reason'] ?? r['issueDescription'] ?? '—').slice(0, 50),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Bảo hành</div>
          <div className="nx-page-subtitle">Hàng đợi yêu cầu bảo hành / đổi trả</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Order ID…"
        searchLabel="Order ID"
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
        emptyDescription="Chưa có yêu cầu khớp bộ lọc."
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
