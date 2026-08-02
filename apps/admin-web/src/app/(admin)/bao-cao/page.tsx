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
      const dateA = String(a['metricDate'] ?? a['date'] ?? a['day'] ?? '');
      const dateB = String(b['metricDate'] ?? b['date'] ?? b['day'] ?? '');
      const valA = Number(a['value'] ?? a['revenue'] ?? a['gmv'] ?? 0);
      const valB = Number(b['value'] ?? b['revenue'] ?? b['gmv'] ?? 0);
      if (sort === 'date_asc') return dateA.localeCompare(dateB);
      if (sort === 'value_desc') return valB - valA;
      if (sort === 'value_asc') return valA - valB;
      return dateB.localeCompare(dateA);
    });
    return rows;
  }, [items, sort]);

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'metricDate',
        header: 'Ngày',
        render: (r) => String(r['metricDate'] ?? r['date'] ?? r['day'] ?? '—'),
      },
      {
        key: 'domain',
        header: 'Domain',
        render: (r) => String(r['domain'] ?? '—'),
      },
      {
        key: 'metricKey',
        header: 'Metric',
        render: (r) =>
          String(r['metricKey'] ?? r['ordersCount'] ?? r['orderCount'] ?? '—'),
      },
      {
        key: 'value',
        header: 'Giá trị',
        render: (r) => {
          const v = r['value'] ?? r['revenue'] ?? r['gmv'];
          return typeof v === 'number'
            ? v.toLocaleString('vi-VN')
            : String(v ?? '—');
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
          <div className="nx-page-subtitle">
            Daily metrics (`metricDate` / `metricKey` / `value`)
          </div>
        </div>
      </div>
      <ListToolbar
        searchValue={domainInput}
        onSearchChange={setDomainInput}
        searchPlaceholder="ORDER / PAYMENT / …"
        searchLabel="Domain"
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'date_desc', label: 'Ngày mới nhất' },
          { value: 'date_asc', label: 'Ngày cũ nhất' },
          { value: 'value_desc', label: 'Giá trị giảm' },
          { value: 'value_asc', label: 'Giá trị tăng' },
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
          String(r.id ?? `${r['metricDate']}-${r['metricKey']}`)
        }
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Chưa có metrics"
        emptyDescription="Projection daily metric trống hoặc domain không khớp."
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
