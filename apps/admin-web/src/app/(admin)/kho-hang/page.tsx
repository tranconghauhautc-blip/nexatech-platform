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
    service: 'inventory',
    path: 'stock',
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'skuCode',
        header: 'SKU',
        render: (r) => String(r['skuCode'] ?? r.id ?? ''),
      },
      {
        key: 'available',
        header: 'Khả dụng',
        render: (r) => String(r['available'] ?? r['onHand'] ?? '—'),
      },
      {
        key: 'locationId',
        header: 'Vị trí',
        render: (r) =>
          String(r['locationId'] ?? r['warehouseId'] ?? r['storeId'] ?? '—'),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Tồn kho</div>
          <div className="nx-page-subtitle">Theo dõi tồn theo SKU/vị trí</div>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) =>
          String(r.id ?? `${r['skuCode']}-${r['locationId']}` ?? Math.random())
        }
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có bản ghi hoặc backend chưa sẵn sàng."
      />
    </div>
  );
}
