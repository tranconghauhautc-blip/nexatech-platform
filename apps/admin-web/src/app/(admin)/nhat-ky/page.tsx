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

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

export default function Page() {
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ action: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'reporting',
    path: 'admin/reporting/audit-logs',
    page: controls.page,
    filters: controls.filters,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'createdAt',
        header: 'Thời gian',
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
      {
        key: 'action',
        header: 'Hành động',
        render: (r) => String(r['action'] ?? '—'),
      },
      {
        key: 'actorId',
        header: 'Actor',
        render: (r) => String(r['actorId'] ?? '—').slice(0, 12),
      },
      {
        key: 'resourceType',
        header: 'Resource',
        render: (r) =>
          `${String(r['resourceType'] ?? '—')}:${String(r['resourceId'] ?? '')}`.slice(
            0,
            40,
          ),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Nhật ký</div>
          <div className="nx-page-subtitle">Audit log hệ thống</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Tên hành động…"
        searchLabel="Action"
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
        emptyDescription="Chưa có audit log khớp bộ lọc."
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
