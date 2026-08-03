'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/toast';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import { clientFilterRows, shortenId } from '../../../lib/display-helpers';
import {
  resolveOrderApiFilters,
  useHumanListControls,
} from '../../../lib/human-search';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ' },
  { value: 'REQUIRES_ACTION', label: 'Cần thao tác' },
  { value: 'AUTHORIZED', label: 'Đã ủy quyền' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'REFUNDED', label: 'Hoàn tiền' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'amount_desc', label: 'Số tiền giảm' },
  { value: 'amount_asc', label: 'Số tiền tăng' },
];

const TONE: Record<string, BadgeTone> = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'info',
  CANCELLED: 'neutral',
  REQUIRES_ACTION: 'warning',
  AUTHORIZED: 'info',
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

function formatMoney(amount: unknown): string {
  return typeof amount === 'number'
    ? `${amount.toLocaleString('vi-VN')} ₫`
    : String(amount ?? '—');
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export default function Page() {
  const { showToast } = useToast();
  const controls = useHumanListControls({
    defaultSort: 'createdAt_desc',
    resolveApiFilters: resolveOrderApiFilters,
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'payment',
    path: 'admin/payments',
    page: controls.page,
    filters: controls.filters,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);

  const displayedItems = useMemo(() => {
    if (!controls.clientSearch) return items;
    return clientFilterRows(items, controls.clientSearch, [
      (r) => String(r['orderCode'] ?? ''),
      (r) => String(r['paymentReference'] ?? r['id'] ?? ''),
      (r) => String(r['method'] ?? r['provider'] ?? ''),
      (r) => String(r['status'] ?? ''),
      (r) => String(r['orderId'] ?? ''),
      (r) => String(r['customerId'] ?? ''),
    ]);
  }, [items, controls.clientSearch]);

  async function openPayment(row: Record<string, unknown>) {
    const id = String(row['id'] ?? '');
    if (!id) return;
    setSelectedId(id);
    setDetail(row);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'payment',
        `admin/payments/${id}`,
      );
      setDetail(data ?? row);
    } catch (err) {
      setDetailError(
        getErrorMessage(err, 'Không tải được chi tiết thanh toán'),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }

  async function collectCod() {
    if (!selectedId) return;
    setCollecting(true);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'payment',
        `admin/payments/${selectedId}/cod-collect`,
        { method: 'POST' },
      );
      setDetail(data);
      showToast('Đã thu COD', 'success');
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Thu COD thất bại'), 'error');
    } finally {
      setCollecting(false);
    }
  }

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'paymentReference',
        header: 'Mã thanh toán',
        render: (r) =>
          String(r['paymentReference'] ?? shortenId(String(r['id'] ?? ''))),
      },
      {
        key: 'orderCode',
        header: 'Đơn hàng',
        render: (r) => {
          const orderCode = String(r['orderCode'] ?? '—');
          const orderId = String(r['orderId'] ?? '');
          return <span title={orderId || undefined}>{orderCode}</span>;
        },
      },
      {
        key: 'method',
        header: 'Phương thức',
        render: (r) => String(r['method'] ?? r['provider'] ?? '—'),
      },
      {
        key: 'amount',
        header: 'Số tiền',
        render: (r) => formatMoney(r['amount']),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => {
          const status = String(r['status'] ?? '');
          return (
            <Badge tone={TONE[status] ?? 'neutral'}>
              {STATUS_LABEL[status] ?? (status || '—')}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  const provider = String(detail?.['provider'] ?? detail?.['method'] ?? '');
  const status = String(detail?.['status'] ?? '');
  const canCollectCod =
    provider.toUpperCase() === 'COD' && status === 'PENDING';

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Thanh toán</div>
          <div className="nx-page-subtitle">Theo dõi payment intents</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã đơn, mã thanh toán, phương thức…"
        searchLabel="Tìm kiếm"
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
        onApply={() => void controls.applySearch()}
        onReset={() => {
          controls.resetAll();
          closeDrawer();
        }}
      />
      {controls.clientSearch ? (
        <p className="nx-hint" style={{ marginBottom: 8 }}>
          Lọc thêm theo &quot;{controls.clientSearch}&quot; trên trang hiện tại
          (mã đơn, mã TT, phương thức…).
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={displayedItems}
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={loading || controls.resolving}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có thanh toán khớp bộ lọc."
        onRowClick={(row) => void openPayment(row)}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: controls.clientSearch
            ? displayedItems.length
            : meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />

      <Drawer
        open={Boolean(selectedId)}
        title={
          detail
            ? String(
                detail['paymentReference'] ??
                  shortenId(String(detail['id'] ?? '')),
              )
            : 'Chi tiết thanh toán'
        }
        onClose={closeDrawer}
      >
        {detailLoading ? (
          <p className="nx-hint">Đang tải chi tiết…</p>
        ) : detailError ? (
          <div style={{ padding: '0 4px 16px' }}>
            <p className="nx-error-text">{detailError}</p>
            <button
              type="button"
              className="nx-btn nx-btn-secondary nx-btn-sm"
              onClick={() => selectedId && void openPayment({ id: selectedId })}
            >
              Thử lại
            </button>
          </div>
        ) : detail ? (
          <div style={{ padding: '0 4px 16px', display: 'grid', gap: 16 }}>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: '8px 12px',
                fontSize: 14,
                margin: 0,
              }}
            >
              <dt className="nx-hint">Mã TT</dt>
              <dd style={{ margin: 0 }}>
                {String(detail['paymentReference'] ?? detail['id'] ?? '—')}
              </dd>
              <dt className="nx-hint">Đơn hàng</dt>
              <dd style={{ margin: 0 }} title={String(detail['orderId'] ?? '')}>
                {String(detail['orderCode'] ?? detail['orderId'] ?? '—')}
              </dd>
              <dt className="nx-hint">Phương thức</dt>
              <dd style={{ margin: 0 }}>
                {String(detail['method'] ?? detail['provider'] ?? '—')}
              </dd>
              <dt className="nx-hint">Số tiền</dt>
              <dd style={{ margin: 0 }}>{formatMoney(detail['amount'])}</dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Tạo lúc</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Thao tác</div>
              {canCollectCod ? (
                <button
                  type="button"
                  className="nx-btn nx-btn-primary nx-btn-sm"
                  style={{ marginTop: 8 }}
                  disabled={collecting}
                  onClick={() => void collectCod()}
                >
                  {collecting ? 'Đang thu…' : 'Thu COD'}
                </button>
              ) : (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  {provider.toUpperCase() === 'COD'
                    ? 'COD đã thu hoặc không còn ở trạng thái chờ.'
                    : 'Không có thao tác COD cho phương thức này.'}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
