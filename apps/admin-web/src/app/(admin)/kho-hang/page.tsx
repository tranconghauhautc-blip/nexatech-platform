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
  const [sort, setSort] = useState('sku_asc');
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'inventory',
    path: 'stock',
    query: search ? { skuCode: search } : undefined,
  });
  const sortedItems = useMemo(() => {
    const rows = [...items];
    rows.sort((a, b) => {
      const skuA = String(a['skuCode'] ?? a.id ?? '');
      const skuB = String(b['skuCode'] ?? b.id ?? '');
      const availA = Number(a['available'] ?? a['onHand'] ?? 0);
      const availB = Number(b['available'] ?? b['onHand'] ?? 0);
      if (sort === 'sku_desc') return skuB.localeCompare(skuA);
      if (sort === 'available_desc') return availB - availA;
      if (sort === 'available_asc') return availA - availB;
      return skuA.localeCompare(skuB);
    });
    return rows;
  }, [items, sort]);
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
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'sku_asc', label: 'SKU A→Z' },
          { value: 'sku_desc', label: 'SKU Z→A' },
          { value: 'available_desc', label: 'Khả dụng giảm' },
          { value: 'available_asc', label: 'Khả dụng tăng' },
        ]}
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
          setSort('sku_asc');
        }}
      />
      <DataTable
        columns={columns}
        rows={sortedItems}
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
