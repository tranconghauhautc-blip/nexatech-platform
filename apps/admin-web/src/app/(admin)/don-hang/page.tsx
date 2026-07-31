'use client';

import { useMemo, useState } from 'react';
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
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'AWAITING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'READY_TO_SHIP', label: 'Sẵn sàng giao' },
  { value: 'SHIPPED', label: 'Đã giao vận' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'grandTotal_desc', label: 'Tổng tiền giảm' },
  { value: 'grandTotal_asc', label: 'Tổng tiền tăng' },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  AWAITING_PAYMENT: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  READY_TO_SHIP: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export default function Page() {
  const controls = useListControls({
    defaultSort: 'createdAt_desc',
    searchToFilters: (search) => ({ orderCode: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'order',
    path: 'admin/orders',
    page: controls.page,
    filters: controls.filters,
  });

  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã đơn',
        render: (r) => String(r['code'] ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => {
          const status = String(r['status'] ?? '');
          return (
            <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status || '—'}</Badge>
          );
        },
      },
      {
        key: 'paymentStatus',
        header: 'Thanh toán',
        render: (r) => String(r['paymentStatus'] ?? '—'),
      },
      {
        key: 'grandTotal',
        header: 'Tổng',
        render: (r) => {
          const total = r['grandTotal'];
          return typeof total === 'number'
            ? total.toLocaleString('vi-VN') + ' ₫'
            : String(total ?? '—');
        },
      },
      {
        key: 'createdAt',
        header: 'Tạo lúc',
        render: (r) => {
          const raw = r['createdAt'];
          if (typeof raw !== 'string') return '—';
          try {
            return new Date(raw).toLocaleString('vi-VN');
          } catch {
            return raw;
          }
        },
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Đơn hàng</div>
          <div className="nx-page-subtitle">Quản lý đơn hàng Staff+</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã đơn hàng…"
        searchLabel="Mã đơn"
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
        emptyDescription="Chưa có đơn hàng khớp bộ lọc."
        onRowClick={(row) => setSelected(row)}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
      {selected ? (
        <div className="nx-panel" style={{ marginTop: 16 }}>
          <div className="nx-card-title">Chi tiết đơn {String(selected['code'] ?? '')}</div>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(selected, null, 2)}
          </pre>
          <button
            type="button"
            className="nx-btn nx-btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => setSelected(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}
    </div>
  );
}
