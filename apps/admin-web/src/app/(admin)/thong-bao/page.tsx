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
  { value: 'PENDING', label: 'Chờ gửi' },
  { value: 'SENT', label: 'Đã gửi' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'BOUNCED', label: 'Bounce' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

export default function Page() {
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ q: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'notification',
    path: 'admin/notifications/email-deliveries',
    page: controls.page,
    filters: {
      ...(controls.status ? { status: controls.status } : {}),
      ...(controls.search ? { to: controls.search } : {}),
    },
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (r) => String(r['id'] ?? '—').slice(0, 8),
      },
      {
        key: 'to',
        header: 'Người nhận',
        render: (r) => String(r['to'] ?? r['recipient'] ?? '—'),
      },
      {
        key: 'subject',
        header: 'Tiêu đề',
        render: (r) => String(r['subject'] ?? '—').slice(0, 50),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => <Badge>{String(r['status'] ?? '—')}</Badge>,
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Thông báo</div>
          <div className="nx-page-subtitle">Email delivery log</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Email người nhận…"
        searchLabel="Email"
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
        emptyDescription="Chưa có bản ghi email khớp bộ lọc."
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
