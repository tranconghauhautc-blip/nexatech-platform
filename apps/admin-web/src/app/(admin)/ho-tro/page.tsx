'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';

export default function Page() {
  const [page, setPage] = useState(1);
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'support',
    path: 'admin/support/tickets',
    page,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'subject',
        header: 'Tiêu đề',
        render: (r) => String(r['subject'] ?? r.id ?? ''),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => String(r['status'] ?? r.id ?? ''),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Hỗ trợ</div>
          <div className="nx-page-subtitle">Hàng đợi ticket</div>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có bản ghi hoặc backend chưa sẵn sàng."
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={setPage}
      />
    </div>
  );
}
