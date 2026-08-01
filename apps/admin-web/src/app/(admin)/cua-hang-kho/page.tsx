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
  const [sort, setSort] = useState('name_asc');
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'inventory',
    path: 'warehouses',
  });
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = !search
      ? [...items]
      : items.filter((row) =>
          [row['name'], row['code'], row['id'], row['city']]
            .map((v) => String(v ?? '').toLowerCase())
            .some((v) => v.includes(q)),
        );
    rows.sort((a, b) => {
      const nameA = String(a['name'] ?? '');
      const nameB = String(b['name'] ?? '');
      const codeA = String(a['code'] ?? a['id'] ?? '');
      const codeB = String(b['code'] ?? b['id'] ?? '');
      if (sort === 'name_desc') return nameB.localeCompare(nameA);
      if (sort === 'code_asc') return codeA.localeCompare(codeB);
      if (sort === 'code_desc') return codeB.localeCompare(codeA);
      return nameA.localeCompare(nameB);
    });
    return rows;
  }, [items, search, sort]);
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
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'name_asc', label: 'Tên A→Z' },
          { value: 'name_desc', label: 'Tên Z→A' },
          { value: 'code_asc', label: 'Mã A→Z' },
          { value: 'code_desc', label: 'Mã Z→A' },
        ]}
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
          setSort('name_asc');
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
