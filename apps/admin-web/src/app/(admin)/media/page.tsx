'use client';

import { useMemo } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';

export default function Page() {
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'media',
    path: 'media/by-entity/product/placeholder',
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      { key: 'id', header: 'ID', render: (r) => String(r['id'] ?? r.id ?? '') },
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
          <div className="nx-page-title">Media</div>
          <div className="nx-page-subtitle">
            Media theo entity (cần entity thật ở milestone sau)
          </div>
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
    </div>
  );
}
