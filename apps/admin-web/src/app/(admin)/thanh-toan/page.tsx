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
import { Badge, type BadgeTone } from '../../../components/ui/Badge';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ' },
  { value: 'REQUIRES_ACTION', label: 'Cần thao tác' },
  { value: 'AUTHORIZED', label: 'Đã ủy quyền' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'REFUNDED', label: 'Hoàn tiền' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'amount_desc', label: 'Số tiền giảm' },
  { value: 'amount_asc', label: 'Số tiền tăng' },
];

const TONE: Record<string, BadgeTone> = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'info',
  CANCELLED: 'neutral',
};

export default function Page() {
  const controls = useListControls({
    defaultSort: 'createdAt_desc',
    searchToFilters: (search) => ({ orderId: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'payment',
    path: 'admin/payments',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Payment ID',
        render: (r) => String(r['id'] ?? '—'),
      },
      {
        key: 'orderId',
        header: 'Order',
        render: (r) => String(r['orderId'] ?? '—'),
      },
      {
        key: 'method',
        header: 'Phương thức',
        render: (r) => String(r['method'] ?? r['provider'] ?? '—'),
      },
      {
        key: 'amount',
        header: 'Số tiền',
        render: (r) => {
          const amount = r['amount'];
          return typeof amount === 'number'
            ? amount.toLocaleString('vi-VN') + ' ₫'
            : String(amount ?? '—');
        },
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => {
          const status = String(r['status'] ?? '');
          return (
            <Badge tone={TONE[status] ?? 'neutral'}>{status || '—'}</Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Thanh toán</div>
          <div className="nx-page-subtitle">Theo dõi payment intents</div>
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
        emptyDescription="Chưa có thanh toán khớp bộ lọc."
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
