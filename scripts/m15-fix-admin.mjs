import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(rel);
}

/** @type {Array<[string,string,string,string,string,boolean,Array<[string,string]>]>} */
const pages = [
  [
    'san-pham',
    'Sản phẩm',
    'Quản lý catalog sản phẩm',
    'catalog',
    'admin/catalog/products',
    true,
    [
      ['name', 'Tên'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'kho-hang',
    'Tồn kho',
    'Theo dõi tồn theo SKU/vị trí',
    'inventory',
    'stock',
    true,
    [
      ['skuCode', 'SKU'],
      ['available', 'Khả dụng'],
    ],
  ],
  [
    'cua-hang-kho',
    'Kho & cửa hàng',
    'Danh sách kho',
    'inventory',
    'warehouses',
    false,
    [
      ['name', 'Tên'],
      ['city', 'Thành phố'],
    ],
  ],
  [
    'don-hang',
    'Đơn hàng',
    'Quản lý đơn hàng Staff+',
    'order',
    'admin/orders',
    true,
    [
      ['code', 'Mã đơn'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'thanh-toan',
    'Thanh toán',
    'Theo dõi payment intents',
    'payment',
    'admin/payments',
    true,
    [
      ['id', 'Payment'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'van-chuyen',
    'Vận chuyển',
    'Danh sách shipment',
    'shipping',
    'admin/shipping/shipments',
    true,
    [
      ['trackingCode', 'Tracking'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'danh-gia',
    'Đánh giá',
    'Kiểm duyệt đánh giá',
    'review',
    'admin/reviews',
    true,
    [
      ['id', 'ID'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'bao-hanh',
    'Bảo hành / đổi trả',
    'Yêu cầu bảo hành',
    'warranty',
    'admin/warranty/claims',
    true,
    [
      ['id', 'Claim'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'ho-tro',
    'Hỗ trợ',
    'Hàng đợi ticket',
    'support',
    'admin/support/tickets',
    true,
    [
      ['subject', 'Tiêu đề'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'thong-bao',
    'Thông báo',
    'Email deliveries',
    'notification',
    'admin/notifications/email-deliveries',
    true,
    [
      ['id', 'ID'],
      ['status', 'Trạng thái'],
    ],
  ],
  [
    'bao-cao',
    'Báo cáo',
    'Metrics daily',
    'reporting',
    'admin/reporting/metrics/daily',
    true,
    [
      ['date', 'Ngày'],
      ['ordersCount', 'Đơn'],
    ],
  ],
  [
    'nhat-ky',
    'Nhật ký audit',
    'Audit logs',
    'reporting',
    'admin/reporting/audit-logs',
    true,
    [
      ['action', 'Hành động'],
      ['actorId', 'Actor'],
    ],
  ],
  [
    'media',
    'Media',
    'Media theo entity (cần entity thật ở milestone sau)',
    'media',
    'media/by-entity/product/placeholder',
    false,
    [
      ['id', 'ID'],
      ['status', 'Trạng thái'],
    ],
  ],
];

for (const [
  slug,
  title,
  subtitle,
  service,
  apiPath,
  paginated,
  cols,
] of pages) {
  const colSrc = cols
    .map(
      ([k, h]) =>
        `{ key: '${k}', header: '${h}', render: (r) => String(r['${k}'] ?? r.id ?? '') }`,
    )
    .join(',\n      ');

  const body = paginated
    ? `'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/ui/Pagination';

export default function Page() {
  const [page, setPage] = useState(1);
  const { items, meta, loading, error, refetch } = useListQuery<Record<string, unknown>>({
    service: '${service}',
    path: '${apiPath}',
    page,
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      ${colSrc}
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">${title}</div>
          <div className="nx-page-subtitle">${subtitle}</div>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có bản ghi hoặc backend chưa sẵn sàng."
      />
      <Pagination
        meta={{ page: meta.page, pageSize: meta.pageSize, total: meta.totalItems }}
        onPageChange={setPage}
      />
    </div>
  );
}
`
    : `'use client';

import { useMemo } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';

export default function Page() {
  const { items, loading, error, refetch } = useArrayQuery<Record<string, unknown>>({
    service: '${service}',
    path: '${apiPath}',
  });
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      ${colSrc}
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">${title}</div>
          <div className="nx-page-subtitle">${subtitle}</div>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có bản ghi hoặc backend chưa sẵn sàng."
      />
    </div>
  );
}
`;

  w(`apps/admin-web/src/app/(admin)/${slug}/page.tsx`, body);
}

console.log('fixed');
