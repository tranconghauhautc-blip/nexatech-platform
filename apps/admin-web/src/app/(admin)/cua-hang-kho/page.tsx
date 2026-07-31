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
    path: 'warehouses',
  });
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((row) =>
      [row['name'], row['code'], row['id'], row['city']]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [items, search]);
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã',
        render: (r) => String(r['code'] ?? r['id'] ?? '—'),
      },
      {
        key: 'name',
        header: 'Tên',
        render: (r) => String(r['name'] ?? '—'),
      },
      {
        key: 'city',
        header: 'Thành phố',
        render: (r) => String(r['city'] ?? r['address'] ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => String(r['status'] ?? (r['active'] === false ? 'INACTIVE' : 'ACTIVE')),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Cửa hàng & kho</div>
          <div className="nx-page-subtitle">Danh sách kho / cửa hàng</div>
        </div>
      </div>
      <ListToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Tên hoặc mã kho…"
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
        }}
      />
      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có kho/cửa hàng khớp bộ lọc."
      />
    </div>
  );
}
