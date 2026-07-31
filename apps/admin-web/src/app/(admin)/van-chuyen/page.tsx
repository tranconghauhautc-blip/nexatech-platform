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
  { value: 'LABEL_CREATED', label: 'Đã tạo nhãn' },
  { value: 'PICKED_UP', label: 'Đã lấy hàng' },
  { value: 'IN_TRANSIT', label: 'Đang vận chuyển' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'shippingFee_desc', label: 'Phí giảm' },
  { value: 'shippingFee_asc', label: 'Phí tăng' },
];

const TONE: Record<string, BadgeTone> = {
  DELIVERED: 'success',
  IN_TRANSIT: 'info',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  PENDING: 'warning',
};

export default function Page() {
  const controls = useListControls({
    defaultSort: 'createdAt_desc',
    searchToFilters: (search) => ({ orderId: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'shipping',
    path: 'admin/shipments',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Shipment',
        render: (r) => String(r['id'] ?? '—'),
      },
      {
        key: 'orderId',
        header: 'Order',
        render: (r) => String(r['orderId'] ?? '—'),
      },
      {
        key: 'trackingCode',
        header: 'Tracking',
        render: (r) =>
          String(r['trackingCode'] ?? r['providerTrackingNumber'] ?? '—'),
      },
      {
        key: 'provider',
        header: 'Đơn vị',
        render: (r) => String(r['provider'] ?? '—'),
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
          <div className="nx-page-title">Vận chuyển</div>
          <div className="nx-page-subtitle">Theo dõi kiện hàng</div>
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
        emptyDescription="Chưa có kiện hàng khớp bộ lọc."
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
