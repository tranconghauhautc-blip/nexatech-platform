'use client';

import { useEffect, useMemo, useState } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';

interface LocationRow {
  id: string;
  code?: string;
  name?: string;
}

export default function Page() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('sku_asc');
  const [locationNames, setLocationNames] = useState<Record<string, string>>(
    {},
  );
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'inventory',
    path: 'stock',
    query: search ? { skuCode: search } : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      bffRequest<LocationRow[]>('inventory', 'warehouses').catch(() => []),
      bffRequest<LocationRow[]>('inventory', 'stores').catch(() => []),
    ]).then(([warehouses, stores]) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const row of [...warehouses, ...stores]) {
        if (!row?.id) continue;
        const label =
          [row.name, row.code].filter(Boolean).join(' · ') || row.id;
        map[row.id] = label;
      }
      setLocationNames(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        render: (r) => {
          const id = String(
            r['locationId'] ?? r['warehouseId'] ?? r['storeId'] ?? '',
          );
          if (!id) return '—';
          const name = locationNames[id];
          if (!name) {
            return <span title={id}>{id}</span>;
          }
          return (
            <span title={id}>
              {name}
              <br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>{id}</span>
            </span>
          );
        },
      },
    ],
    [locationNames],
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
          String(r.id ?? `${String(r['skuCode'])}-${String(r['locationId'])}`)
        }
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có tồn kho"
        emptyDescription="Chưa có bản ghi stock hoặc SKU không khớp."
      />
    </div>
  );
}
