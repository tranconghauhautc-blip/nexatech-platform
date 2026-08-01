'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';

export default function Page() {
  const [page, setPage] = useState(1);
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState('');
  const [sort, setSort] = useState('date_desc');
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'reporting',
    path: 'admin/reporting/metrics/daily',
    page,
    filters: domain ? { domain } : undefined,
  });
  const sortedItems = useMemo(() => {
    const rows = [...items];
    rows.sort((a, b) => {
      const dateA = String(a['date'] ?? a['day'] ?? '');
      const dateB = String(b['date'] ?? b['day'] ?? '');
      const revA = Number(a['revenue'] ?? a['gmv'] ?? 0);
      const revB = Number(b['revenue'] ?? b['gmv'] ?? 0);
      if (sort === 'date_asc') return dateA.localeCompare(dateB);
      if (sort === 'revenue_desc') return revB - revA;
      if (sort === 'revenue_asc') return revA - revB;
      return dateB.localeCompare(dateA);
    });
    return rows;
  }, [items, sort]);
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'date',
        header: 'Ngày',
        render: (r) => String(r['date'] ?? r['day'] ?? '—'),
      },
      {
        key: 'domain',
        header: 'Domain',
        render: (r) => String(r['domain'] ?? '—'),
      },
      {
        key: 'ordersCount',
        header: 'Đơn',
        render: (r) => String(r['ordersCount'] ?? r['orderCount'] ?? '—'),
      },
      {
        key: 'revenue',
        header: 'Doanh thu',
        render: (r) => {
          const v = r['revenue'] ?? r['gmv'];
          return typeof v === 'number' ? v.toLocaleString('vi-VN') : String(v ?? '—');
        },
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Báo cáo</div>
          <div className="nx-page-subtitle">Metrics daily</div>
        </div>
      </div>
      <ListToolbar
        searchValue={domainInput}
        onSearchChange={setDomainInput}
        searchPlaceholder="order / payment / …"
        searchLabel="Domain"
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'date_desc', label: 'Ngày mới nhất' },
          { value: 'date_asc', label: 'Ngày cũ nhất' },
          { value: 'revenue_desc', label: 'Doanh thu giảm' },
          { value: 'revenue_asc', label: 'Doanh thu tăng' },
        ]}
        onApply={() => {
          setDomain(domainInput.trim());
          setPage(1);
        }}
        onReset={() => {
          setDomainInput('');
          setDomain('');
          setSort('date_desc');
          setPage(1);
        }}
      />
      <DataTable
        columns={columns}
        rows={sortedItems}
        getRowKey={(r) =>
          String(r.id ?? `${r['date']}-${r['domain']}` ?? Math.random())
        }
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có metrics khớp bộ lọc."
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
