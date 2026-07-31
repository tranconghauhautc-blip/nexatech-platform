'use client';

import { useMemo, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { useListQuery } from '../../../lib/use-list-query';
import type { ProductSummaryRow } from '../../../lib/types';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
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

export default function Page() {
  const [page, setPage] = useState(1);
  const { items, meta, loading, error, refetch } =
    useListQuery<ProductSummaryRow>({
      service: 'catalog',
      path: 'products',
      page,
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
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có bản ghi hoặc backend chưa sẵn sàng."
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
