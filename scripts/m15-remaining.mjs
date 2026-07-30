/**
 * Generate remaining account + admin list pages + error/seo/docker
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log(rel);
}

const accountClientPage = (title, description, fetchSnippet) => `'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

export default function Page() {
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    ${fetchSnippet}
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
        setItems(list);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="nt-skeleton" style={{ minHeight: 160 }} aria-busy="true" />;
  }
  if (error) {
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description={error}
        action={<button type="button" className="nt-btn nt-btn-primary" onClick={load}>Thử lại</button>}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="${title}"
        description="${description}"
        action={<Link href="/" className="nt-btn nt-btn-primary">Về trang chủ</Link>}
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>${title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {items.map((item, index) => {
          const record = item as Record<string, unknown>;
          const id = String(record.id ?? record.code ?? index);
          const label = String(record.code ?? record.subject ?? record.productName ?? record.title ?? id);
          return (
            <li key={id} style={{ border: '1px solid #dbeafe', borderRadius: 12, padding: '0.85rem', background: '#fff' }}>
              <strong>{label}</strong>
              {record.status ? <div style={{ color: '#4b6478' }}>Trạng thái: {String(record.status)}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
`;

w(
  'apps/storefront-web/src/app/tai-khoan/don-hang/page.tsx',
  accountClientPage(
    'Đơn hàng của tôi',
    'Bạn chưa có đơn hàng nào.',
    `bff.get('/api/bff/order/orders')`,
  ),
);

w(
  'apps/storefront-web/src/app/tai-khoan/don-hang/[id]/page.tsx',
  `'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { EmptyState } from '../../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../../lib/api-browser';
import { ORDER_STATUS_LABELS } from '../../../../lib/constants';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [shipments, setShipments] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id;
    Promise.all([
      bff.get<Record<string, unknown>>(\`/api/bff/order/orders/\${id}\`),
      bff.get<unknown[]>(\`/api/bff/shipping/shipping/shipments/by-order/\${id}\`).catch(() => []),
    ])
      .then(([orderData, shipmentData]) => {
        setOrder(orderData);
        setShipments(Array.isArray(shipmentData) ? shipmentData : []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="nt-skeleton" style={{ minHeight: 180 }} />;
  if (error || !order) {
    return <EmptyState title="Không tìm thấy đơn" description={error ?? 'Đơn hàng không tồn tại hoặc bạn không có quyền xem.'} action={<Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-primary">Danh sách đơn</Link>} />;
  }

  const status = String(order.status ?? '');
  const total = Number(order.grandTotal ?? order.totalAmount ?? 0);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Đơn {String(order.code ?? order.id)}</h2>
      <p>Trạng thái: {ORDER_STATUS_LABELS[status] ?? status}</p>
      <p>Tổng: <strong>{formatVnd(total)}</strong></p>
      <h3>Vận chuyển</h3>
      {shipments.length === 0 ? <p style={{ color: '#4b6478' }}>Chưa có kiện vận chuyển.</p> : (
        <ul>{shipments.map((s, i) => {
          const row = s as Record<string, unknown>;
          return <li key={String(row.id ?? i)}>{String(row.trackingCode ?? row.id)} — {String(row.status ?? '')}</li>;
        })}</ul>
      )}
      <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-ghost">Quay lại</Link>
    </div>
  );
}
`,
);

const accountRoutes = [
  [
    'ho-so',
    'Hồ sơ & địa chỉ',
    'Chưa có hồ sơ hoặc địa chỉ.',
    `bff.get('/api/bff/customer/customers/me/addresses')`,
  ],
  [
    'thanh-toan',
    'Thanh toán',
    'Chưa có giao dịch thanh toán.',
    `bff.get('/api/bff/payment/payments')`,
  ],
  [
    'yeu-thich',
    'Yêu thích',
    'Danh sách yêu thích trống.',
    `bff.get('/api/bff/cart/wishlist')`,
  ],
  [
    'so-sanh',
    'So sánh sản phẩm',
    'Chưa có sản phẩm để so sánh.',
    `bff.get('/api/bff/cart/comparison')`,
  ],
  [
    'da-xem',
    'Đã xem gần đây',
    'Chưa có sản phẩm đã xem.',
    `bff.get('/api/bff/cart/recently-viewed')`,
  ],
  [
    'danh-gia',
    'Đánh giá của tôi',
    'Bạn chưa viết đánh giá.',
    `bff.get('/api/bff/review/reviews/me')`,
  ],
  [
    'bao-hanh',
    'Bảo hành & đổi trả',
    'Chưa có yêu cầu bảo hành/đổi trả.',
    `bff.get('/api/bff/warranty/warranty/claims')`,
  ],
  [
    'ho-tro',
    'Hỗ trợ',
    'Bạn chưa có ticket hỗ trợ.',
    `bff.get('/api/bff/support/support/tickets')`,
  ],
  [
    'thong-bao',
    'Thông báo',
    'Hộp thư thông báo trống.',
    `bff.get('/api/bff/notification/notifications')`,
  ],
];

for (const [slug, title, empty, fetch] of accountRoutes) {
  w(
    `apps/storefront-web/src/app/tai-khoan/${slug}/page.tsx`,
    accountClientPage(title, empty, fetch),
  );
}

w(
  'apps/storefront-web/src/app/not-found.tsx',
  `import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="nt-container" style={{ padding: '3rem 0', textAlign: 'center' }}>
      <h1>Không tìm thấy trang</h1>
      <p style={{ color: '#4b6478' }}>Đường dẫn không tồn tại hoặc đã được di chuyển.</p>
      <Link href="/" className="nt-btn nt-btn-primary">Về trang chủ</Link>
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/error.tsx',
  `'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="nt-container" style={{ padding: '3rem 0' }}>
      <h1>Đã xảy ra lỗi</h1>
      <p style={{ color: '#4b6478' }}>{error.message || 'Vui lòng thử lại.'}</p>
      <button type="button" className="nt-btn nt-btn-primary" onClick={reset}>Thử lại</button>
    </div>
  );
}
`,
);

w(
  'apps/storefront-web/src/app/loading.tsx',
  `export default function Loading() {
  return <div className="nt-container nt-skeleton" style={{ minHeight: 240, margin: '2rem auto' }} aria-busy="true" aria-label="Đang tải" />;
}
`,
);

w(
  'apps/storefront-web/src/app/robots.ts',
  `import type { MetadataRoute } from 'next';
import { getAppBaseUrl } from '../lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: \`\${base}/sitemap.xml\`,
  };
}
`,
);

w(
  'apps/storefront-web/src/app/sitemap.ts',
  `import type { MetadataRoute } from 'next';
import { NAV_CATEGORIES } from '../lib/constants';
import { getAppBaseUrl } from '../lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  return [
    { url: \`\${base}/\`, changeFrequency: 'daily', priority: 1 },
    { url: \`\${base}/tim-kiem\`, changeFrequency: 'daily', priority: 0.8 },
    ...NAV_CATEGORIES.map((c) => ({
      url: \`\${base}/danh-muc/\${c.slug}\`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
`,
);

// Admin list page factory
const adminPage = (
  title,
  subtitle,
  service,
  apiPath,
  columnsHint,
) => `'use client';

import { useMemo } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { LoadingState, EmptyState, ErrorState } from '../../../components/ui/states';

export default function AdminListPage() {
  const { items, meta, loading, error, page, setPage, refetch } = useListQuery<Record<string, unknown>>({
    service: '${service}',
    path: '${apiPath}',
  });

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      ${columnsHint}
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
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState title="Không có dữ liệu" description="Chưa có bản ghi hoặc backend chưa sẵn sàng." /> : null}
      {!loading && !error && items.length > 0 ? (
        <DataTable
          columns={columns}
          rows={items}
          page={page}
          totalPages={meta?.totalPages ?? 1}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
`;

const adminPages = [
  [
    'san-pham',
    'Sản phẩm',
    'Quản lý catalog sản phẩm',
    'catalog',
    'admin/catalog/products',
    `{ key: 'name', header: 'Tên', render: (r) => String(r.name ?? r.slug ?? r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'kho-hang',
    'Tồn kho',
    'Theo dõi tồn theo SKU/vị trí',
    'inventory',
    'stock',
    `{ key: 'skuCode', header: 'SKU', render: (r) => String(r.skuCode ?? '') }, { key: 'available', header: 'Khả dụng', render: (r) => String(r.available ?? '') }`,
  ],
  [
    'cua-hang-kho',
    'Kho & cửa hàng',
    'Danh sách kho và cửa hàng',
    'inventory',
    'warehouses',
    `{ key: 'name', header: 'Tên', render: (r) => String(r.name ?? r.code ?? r.id) }, { key: 'city', header: 'Thành phố', render: (r) => String(r.city ?? '') }`,
  ],
  [
    'don-hang',
    'Đơn hàng',
    'Quản lý đơn hàng Staff+',
    'order',
    'admin/orders',
    `{ key: 'code', header: 'Mã đơn', render: (r) => String(r.code ?? r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'thanh-toan',
    'Thanh toán',
    'Theo dõi payment intents',
    'payment',
    'admin/payments',
    `{ key: 'id', header: 'Payment', render: (r) => String(r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'van-chuyen',
    'Vận chuyển',
    'Danh sách shipment',
    'shipping',
    'admin/shipping/shipments',
    `{ key: 'trackingCode', header: 'Tracking', render: (r) => String(r.trackingCode ?? r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'danh-gia',
    'Đánh giá',
    'Kiểm duyệt đánh giá',
    'review',
    'admin/reviews',
    `{ key: 'id', header: 'ID', render: (r) => String(r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'bao-hanh',
    'Bảo hành / đổi trả',
    'Yêu cầu bảo hành và trả hàng',
    'warranty',
    'admin/warranty/claims',
    `{ key: 'id', header: 'Claim', render: (r) => String(r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'ho-tro',
    'Hỗ trợ',
    'Hàng đợi ticket hỗ trợ',
    'support',
    'admin/support/tickets',
    `{ key: 'subject', header: 'Tiêu đề', render: (r) => String(r.subject ?? r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'thong-bao',
    'Thông báo',
    'Email deliveries / admin notifications',
    'notification',
    'admin/notifications/email-deliveries',
    `{ key: 'id', header: 'ID', render: (r) => String(r.id) }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? '') }`,
  ],
  [
    'bao-cao',
    'Báo cáo',
    'Metrics & projections',
    'reporting',
    'admin/reporting/metrics/daily',
    `{ key: 'date', header: 'Ngày', render: (r) => String(r.date ?? r.day ?? '') }, { key: 'ordersCount', header: 'Đơn', render: (r) => String(r.ordersCount ?? r.orderCount ?? '') }`,
  ],
  [
    'nhat-ky',
    'Nhật ký audit',
    'Audit log projection',
    'reporting',
    'admin/reporting/audit-logs',
    `{ key: 'action', header: 'Hành động', render: (r) => String(r.action ?? r.eventType ?? '') }, { key: 'actorId', header: 'Actor', render: (r) => String(r.actorId ?? '') }`,
  ],
  [
    'media',
    'Media',
    'Media theo entity / quản trị',
    'media',
    'media/admin/cleanup-orphans',
    `{ key: 'id', header: 'ID', render: (r) => String(r.id ?? '—') }, { key: 'status', header: 'Trạng thái', render: (r) => String(r.status ?? 'ready') }`,
  ],
];

for (const [slug, title, subtitle, service, apiPath, cols] of adminPages) {
  w(
    `apps/admin-web/src/app/(admin)/${slug}/page.tsx`,
    adminPage(title, subtitle, service, apiPath, cols),
  );
}

w(
  'apps/admin-web/src/app/(admin)/nguoi-dung/page.tsx',
  `export default function UsersStubPage() {
  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Người dùng & vai trò</div>
          <div className="nx-page-subtitle">Quản trị identity users</div>
        </div>
      </div>
      <div className="nx-panel">
        <p>
          API admin users/roles của identity-service <strong>chưa được triển khai</strong> theo
          docs/API-CONTRACTS.md. Trang này không giả lập dữ liệu.
        </p>
        <p>Khi contract sẵn sàng, Super Admin sẽ quản lý người dùng tại đây.</p>
      </div>
    </div>
  );
}
`,
);

console.log('generated remaining pages');
