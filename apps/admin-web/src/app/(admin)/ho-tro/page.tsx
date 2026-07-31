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
  { value: 'OPEN', label: 'Mở' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_CUSTOMER', label: 'Chờ khách' },
  { value: 'RESOLVED', label: 'Đã xong' },
  { value: 'CLOSED', label: 'Đóng' },
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
    service: 'support',
    path: 'admin/support/tickets',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Ticket',
        render: (r) => String(r['id'] ?? r['code'] ?? '—').slice(0, 10),
      },
      {
        key: 'subject',
        header: 'Tiêu đề',
        render: (r) => String(r['subject'] ?? '—').slice(0, 50),
      },
      {
        key: 'priority',
        header: 'Ưu tiên',
        render: (r) => String(r['priority'] ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => <Badge>{String(r['status'] ?? '—')}</Badge>,
      },
      {
        key: 'customerId',
        header: 'Khách',
        render: (r) => String(r['customerId'] ?? '—').slice(0, 8),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Hỗ trợ</div>
          <div className="nx-page-subtitle">Ticket hỗ trợ khách hàng</div>
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
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có ticket khớp bộ lọc."
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
