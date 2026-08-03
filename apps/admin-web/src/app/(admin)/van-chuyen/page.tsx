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
  { value: 'CREATED', label: 'Đã tạo' },
  { value: 'QUOTED', label: 'Đã báo giá' },
  { value: 'BOOKED', label: 'Đã đặt vận' },
  { value: 'READY_FOR_PICKUP', label: 'Sẵn sàng lấy' },
  { value: 'PICKED_UP', label: 'Đã lấy hàng' },
  { value: 'IN_TRANSIT', label: 'Đang vận chuyển' },
  { value: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'DELIVERY_FAILED', label: 'Giao thất bại' },
  { value: 'RETURN_TO_SENDER', label: 'Hoàn về' },
  { value: 'RETURNED', label: 'Đã hoàn' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'shippingFee_desc', label: 'Phí giảm' },
  { value: 'shippingFee_asc', label: 'Phí tăng' },
];

const TONE: Record<string, BadgeTone> = {
  DELIVERED: 'success',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'info',
  PICKED_UP: 'info',
  READY_FOR_PICKUP: 'info',
  BOOKED: 'info',
  CREATED: 'neutral',
  QUOTED: 'neutral',
  DELIVERY_FAILED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  RETURNED: 'neutral',
  RETURN_TO_SENDER: 'warning',
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

/** Allowed next statuses — mirrors shipping-state-machine. */
const TRANSITIONS: Record<string, string[]> = {
  CREATED: ['QUOTED', 'BOOKED', 'CANCELLED'],
  QUOTED: ['BOOKED', 'CANCELLED'],
  BOOKED: ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'DELIVERED', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  IN_TRANSIT: [
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_FAILED',
    'RETURN_TO_SENDER',
  ],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED', 'RETURN_TO_SENDER'],
  DELIVERY_FAILED: ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER', 'CANCELLED'],
  RETURN_TO_SENDER: ['RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

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
    service: 'shipping',
    path: 'admin/shipments',
    page: controls.page,
    filters: controls.filters,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const displayedItems = useMemo(() => {
    if (!controls.clientSearch) return items;
    return clientFilterRows(items, controls.clientSearch, [
      (r) => String(r['orderCode'] ?? ''),
      (r) => String(r['trackingCode'] ?? r['providerTrackingNumber'] ?? ''),
      (r) => String(r['providerShipmentRef'] ?? ''),
      (r) => String(r['provider'] ?? ''),
      (r) => String(r['orderId'] ?? ''),
      (r) => String(r['id'] ?? ''),
    ]);
  }, [items, controls.clientSearch]);

  async function openShipment(row: Record<string, unknown>) {
    const id = String(row['id'] ?? '');
    if (!id) return;
    setSelectedId(id);
    setDetail(row);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'shipping',
        `admin/shipments/${id}`,
      );
      setDetail(data ?? row);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết kiện'));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setTransitioning(null);
  }

  async function transitionTo(toStatus: string) {
    if (!selectedId) return;
    setTransitioning(toStatus);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'shipping',
        `admin/shipments/${selectedId}/status-transitions`,
        {
          method: 'POST',
          body: { toStatus },
        },
      );
      setDetail(data);
      showToast(
        `Đã chuyển sang ${STATUS_LABEL[toStatus] ?? toStatus}`,
        'success',
      );
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Chuyển trạng thái thất bại'), 'error');
    } finally {
      setTransitioning(null);
    }
  }

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'trackingCode',
        header: 'Mã vận đơn',
        render: (r) => {
          const tracking = String(
            r['trackingCode'] ?? r['providerTrackingNumber'] ?? '—',
          );
          const id = String(r['id'] ?? '');
          return <span title={id || undefined}>{tracking}</span>;
        },
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
        key: 'packageId',
        header: 'Kiện',
        render: (r) => shortenId(String(r['packageId'] ?? '—')),
      },
      {
        key: 'provider',
        header: 'Đơn vị',
        render: (r) => String(r['provider'] ?? '—'),
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

  const status = String(detail?.['status'] ?? '');
  const nextStatuses = TRANSITIONS[status] ?? [];

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Vận chuyển</div>
          <div className="nx-page-subtitle">Theo dõi kiện hàng</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã đơn, mã vận đơn, đơn vị…"
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
          Lọc thêm theo &quot;{controls.clientSearch}&quot; trên trang hiện tại.
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
        emptyDescription="Chưa có kiện khớp bộ lọc."
        onRowClick={(row) => void openShipment(row)}
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
                detail['trackingCode'] ??
                  detail['providerTrackingNumber'] ??
                  shortenId(String(detail['id'] ?? '')),
              )
            : 'Chi tiết vận chuyển'
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
              onClick={() =>
                selectedId && void openShipment({ id: selectedId })
              }
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
              <dt className="nx-hint">Mã vận đơn</dt>
              <dd style={{ margin: 0 }}>
                {String(
                  detail['trackingCode'] ??
                    detail['providerTrackingNumber'] ??
                    '—',
                )}
              </dd>
              <dt className="nx-hint">Đơn hàng</dt>
              <dd style={{ margin: 0 }} title={String(detail['orderId'] ?? '')}>
                {String(detail['orderCode'] ?? detail['orderId'] ?? '—')}
              </dd>
              <dt className="nx-hint">Đơn vị</dt>
              <dd style={{ margin: 0 }}>{String(detail['provider'] ?? '—')}</dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Cập nhật</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['updatedAt'] ?? detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Chuyển trạng thái</div>
              {nextStatuses.length === 0 ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  Không còn thao tác chuyển trạng thái.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {nextStatuses.map((toStatus) => (
                    <button
                      key={toStatus}
                      type="button"
                      className={`nx-btn nx-btn-sm ${
                        toStatus === 'CANCELLED' ||
                        toStatus === 'DELIVERY_FAILED'
                          ? 'nx-btn-danger'
                          : 'nx-btn-secondary'
                      }`}
                      disabled={Boolean(transitioning)}
                      onClick={() => void transitionTo(toStatus)}
                    >
                      {transitioning === toStatus
                        ? 'Đang xử lý…'
                        : (STATUS_LABEL[toStatus] ?? toStatus)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
