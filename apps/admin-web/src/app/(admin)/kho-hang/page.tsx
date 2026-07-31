'use client';

import { useMemo, useState } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';

export default function Page() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'inventory',
    path: 'stock',
    query: search ? { skuCode: search } : undefined,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'skuCode',
        header: 'SKU',
        render: (r) => String(r['skuCode'] ?? r.id ?? ''),
      },
      {
        key: 'onHand',
        header: 'On hand',
        render: (r) => String(r['onHand'] ?? '—'),
      },
      {
        key: 'reserved',
        header: 'Reserved',
        render: (r) => String(r['reserved'] ?? '—'),
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
      <ListToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Mã SKU…"
        searchLabel="SKU"
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
        }}
      />
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
        emptyDescription="Chưa có tồn kho hoặc SKU không khớp."
      />
    </div>
  );
}
