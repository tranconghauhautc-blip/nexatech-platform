'use client';

import { useMemo } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import type { ProductSummaryRow } from '../../../lib/types';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';

const STATUS_LABEL: Record<ProductSummaryRow['status'], string> = {
  draft: 'Nháp',
  active: 'Đang bán',
  inactive: 'Ngừng bán',
  archived: 'Lưu trữ',
};

const STATUS_TONE: Record<ProductSummaryRow['status'], BadgeTone> = {
  draft: 'warning',
  active: 'success',
  inactive: 'neutral',
  archived: 'danger',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Nháp' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
  { value: 'archived', label: 'Lưu trữ' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'name', label: 'Tên A→Z' },
  { value: 'price_asc', label: 'Giá tăng' },
  { value: 'price_desc', label: 'Giá giảm' },
  { value: 'relevance', label: 'Liên quan' },
];

export default function Page() {
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ q: search }),
  });
  const { items, meta, loading, error, refetch } =
    useListQuery<ProductSummaryRow>({
      service: 'catalog',
      path: 'products',
      page: controls.page,
      filters: controls.filters,
    });
  const columns = useMemo<DataTableColumn<ProductSummaryRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Tên',
        render: (r) => r.name,
      },
      {
        key: 'brandName',
        header: 'Thương hiệu',
        render: (r) => r.brandName || '—',
      },
      {
        key: 'categorySlug',
        header: 'Danh mục',
        render: (r) => r.categorySlug || '—',
      },
      {
        key: 'minPrice',
        header: 'Giá từ',
        render: (r) => formatVnd(r.minPrice),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Sản phẩm</div>
          <div className="nx-page-subtitle">Quản lý catalog sản phẩm</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Tên sản phẩm…"
        statusValue={controls.status}
        onStatusChange={(v) => {
          controls.setStatus(v);
          controls.setPage(1);
        }}
        statusOptions={STATUS_OPTIONS}
        sortValue={controls.sort}
        onSortChange={(v) => {
          controls.setSort(v);
          controls.setPage(1);
        }}
        sortOptions={SORT_OPTIONS}
        onApply={controls.apply}
        onReset={controls.reset}
      />
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có sản phẩm khớp bộ lọc."
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
    </div>
  );
}
