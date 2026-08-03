'use client';

import { useEffect, useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { TextField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'AWAITING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'READY_TO_SHIP', label: 'Sẵn sàng giao' },
  { value: 'SHIPPED', label: 'Đã giao vận' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'RETURN_REQUESTED', label: 'Yêu cầu trả' },
  { value: 'RETURNED', label: 'Đã trả' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'FAILED', label: 'Thất bại' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'grandTotal_desc', label: 'Tổng tiền giảm' },
  { value: 'grandTotal_asc', label: 'Tổng tiền tăng' },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  AWAITING_PAYMENT: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  READY_TO_SHIP: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  RETURN_REQUESTED: 'warning',
  RETURNED: 'neutral',
  CANCELLED: 'danger',
  FAILED: 'danger',
};

const SHIPMENT_TONE: Record<string, BadgeTone> = {
  DELIVERED: 'success',
  IN_TRANSIT: 'info',
  PICKED_UP: 'info',
  READY_FOR_PICKUP: 'info',
  BOOKED: 'info',
  CREATED: 'neutral',
  QUOTED: 'neutral',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

/** Allowed next statuses — mirrors order-state-machine (excl. cancel/confirm APIs). */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['AWAITING_PAYMENT', 'FAILED'],
  AWAITING_PAYMENT: ['FAILED'],
  CONFIRMED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['READY_TO_SHIP', 'FAILED'],
  READY_TO_SHIP: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  CANCELLED: [],
  RETURNED: [],
  FAILED: [],
};

const CONFIRMABLE = new Set(['PENDING', 'AWAITING_PAYMENT']);
const CANCELLABLE = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
]);

interface OrderPackageRow {
  id: string;
  packageCode: string;
  status: string;
  trackingCode?: string;
}

interface ShipmentRow {
  id: string;
  packageId: string;
  status: string;
  provider?: string;
}

interface StoreOption {
  id: string;
  code?: string;
  name?: string;
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

function formatMoney(amount: unknown): string {
  return typeof amount === 'number'
    ? `${amount.toLocaleString('vi-VN')} ₫`
    : String(amount ?? '—');
}

export default function Page() {
  const { showToast } = useToast();
  const controls = useListControls({
    defaultSort: 'createdAt_desc',
    searchToFilters: (search) => ({ orderCode: search }),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'order',
    path: 'admin/orders',
    page: controls.page,
    filters: controls.filters,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    bffRequest<StoreOption[]>('inventory', 'stores')
      .then((rows) => {
        if (!cancelled) setStores(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setStores([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const store of stores) {
      if (!store?.id) continue;
      map[store.id] =
        [store.name, store.code].filter(Boolean).join(' · ') || store.id;
    }
    return map;
  }, [stores]);

  async function loadShipments(orderId: string) {
    setShipmentsLoading(true);
    try {
      const rows = await bffRequest<ShipmentRow[]>(
        'shipping',
        `shipments/order/${orderId}`,
      );
      setShipments(Array.isArray(rows) ? rows : []);
    } catch {
      setShipments([]);
    } finally {
      setShipmentsLoading(false);
    }
  }

  async function openOrder(row: Record<string, unknown>) {
    const orderId = String(row['id'] ?? '');
    if (!orderId) return;
    setSelectedId(orderId);
    setDetail(row);
    setCancelReason('');
    setDetailLoading(true);
    setDetailError(null);
    setShipments([]);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'order',
        `admin/orders/${orderId}`,
      );
      setDetail(data ?? row);
      await loadShipments(orderId);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết đơn'));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setShipments([]);
    setCancelReason('');
    setBusyAction(null);
  }

  async function refreshSelected() {
    if (!selectedId) return;
    const data = await bffRequest<Record<string, unknown>>(
      'order',
      `admin/orders/${selectedId}`,
    );
    setDetail(data);
    await loadShipments(selectedId);
    refetch();
  }

  async function confirmOrder() {
    if (!selectedId) return;
    setBusyAction('confirm');
    try {
      await bffRequest('order', `admin/orders/${selectedId}/confirm`, {
        method: 'POST',
        body: {},
      });
      showToast('Đã xác nhận đơn hàng', 'success');
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Xác nhận đơn thất bại'), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelOrder() {
    if (!selectedId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      showToast('Nhập lý do hủy đơn', 'error');
      return;
    }
    setBusyAction('cancel');
    try {
      await bffRequest('order', `admin/orders/${selectedId}/cancel`, {
        method: 'POST',
        body: { reason },
      });
      showToast('Đã hủy đơn hàng', 'success');
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Hủy đơn thất bại'), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function transitionTo(toStatus: string) {
    if (!selectedId) return;
    setBusyAction(toStatus);
    try {
      await bffRequest(
        'order',
        `admin/orders/${selectedId}/status-transitions`,
        {
          method: 'POST',
          body: { toStatus },
        },
      );
      showToast(
        `Đã chuyển sang ${STATUS_LABEL[toStatus] ?? toStatus}`,
        'success',
      );
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Chuyển trạng thái thất bại'), 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function createShipment(pkg: OrderPackageRow) {
    if (!selectedId) return;
    setCreatingPackageId(pkg.id);
    try {
      await bffRequest('shipping', 'shipments', {
        method: 'POST',
        body: {
          orderId: selectedId,
          packageId: pkg.id,
          idempotencyKey: `admin-ship-${pkg.id}`,
        },
      });
      showToast('Đã tạo kiện vận chuyển', 'success');
      await loadShipments(selectedId);
    } catch (err) {
      showToast(getErrorMessage(err, 'Tạo kiện vận chuyển thất bại'), 'error');
    } finally {
      setCreatingPackageId(null);
    }
  }

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'orderCode',
        header: 'Mã đơn',
        render: (r) =>
          String(r['orderCode'] ?? r['code'] ?? r['orderNumber'] ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => {
          const status = String(r['status'] ?? '');
          return (
            <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
              {STATUS_LABEL[status] ?? (status || '—')}
            </Badge>
          );
        },
      },
      {
        key: 'paymentStatus',
        header: 'Thanh toán',
        render: (r) => String(r['paymentStatus'] ?? '—'),
      },
      {
        key: 'deliveryMethod',
        header: 'Giao hàng',
        render: (r) => String(r['deliveryMethod'] ?? '—'),
      },
      {
        key: 'grandTotal',
        header: 'Tổng',
        render: (r) => formatMoney(r['grandTotal']),
      },
      {
        key: 'createdAt',
        header: 'Tạo lúc',
        render: (r) => formatDateTime(r['createdAt']),
      },
    ],
    [],
  );

  const status = String(detail?.['status'] ?? '');
  const deliveryMethod = String(detail?.['deliveryMethod'] ?? '');
  const isPickup = deliveryMethod === 'STORE_PICKUP';
  const pickupStoreId = String(detail?.['pickupStoreId'] ?? '');
  const pickupStoreLabel = pickupStoreId
    ? storeNames[pickupStoreId] || pickupStoreId
    : '—';
  const packages = Array.isArray(detail?.['packages'])
    ? (detail!['packages'] as OrderPackageRow[])
    : [];
  const shipmentByPackage = useMemo(() => {
    const map = new Map<string, ShipmentRow>();
    for (const s of shipments) map.set(s.packageId, s);
    return map;
  }, [shipments]);
  const nextStatuses = TRANSITIONS[status] ?? [];
  const canConfirm = CONFIRMABLE.has(status);
  const canCancel = CANCELLABLE.has(status);

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Đơn hàng</div>
          <div className="nx-page-subtitle">Quản lý đơn hàng Staff+</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã đơn hàng…"
        searchLabel="Mã đơn"
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
        onReset={() => {
          controls.reset();
          closeDrawer();
        }}
      />
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có đơn hàng khớp bộ lọc."
        onRowClick={(row) => void openOrder(row)}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />

      <Drawer
        open={Boolean(selectedId)}
        title={
          detail
            ? String(detail['orderCode'] ?? detail['code'] ?? 'Chi tiết đơn')
            : 'Chi tiết đơn'
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
              onClick={() => selectedId && void openOrder({ id: selectedId })}
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
              <dt className="nx-hint">Mã đơn</dt>
              <dd style={{ margin: 0 }}>
                <strong>
                  {String(detail['orderCode'] ?? detail['code'] ?? '—')}
                </strong>
              </dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Thanh toán</dt>
              <dd style={{ margin: 0 }}>
                {String(detail['paymentStatus'] ?? '—')}
              </dd>
              <dt className="nx-hint">Tổng</dt>
              <dd style={{ margin: 0 }}>{formatMoney(detail['grandTotal'])}</dd>
              <dt className="nx-hint">Giao hàng</dt>
              <dd style={{ margin: 0 }}>
                {isPickup ? (
                  <Badge tone="info">Nhận tại cửa hàng</Badge>
                ) : (
                  deliveryMethod || '—'
                )}
              </dd>
              {isPickup ? (
                <>
                  <dt className="nx-hint">Cửa hàng nhận</dt>
                  <dd style={{ margin: 0 }} title={pickupStoreId || undefined}>
                    {pickupStoreLabel}
                  </dd>
                </>
              ) : null}
              <dt className="nx-hint">Tạo lúc</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Thao tác đơn</div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {canConfirm ? (
                  <button
                    type="button"
                    className="nx-btn nx-btn-primary nx-btn-sm"
                    disabled={Boolean(busyAction)}
                    onClick={() => void confirmOrder()}
                  >
                    {busyAction === 'confirm' ? 'Đang xác nhận…' : 'Xác nhận'}
                  </button>
                ) : null}
                {nextStatuses.map((toStatus) => (
                  <button
                    key={toStatus}
                    type="button"
                    className="nx-btn nx-btn-secondary nx-btn-sm"
                    disabled={Boolean(busyAction)}
                    onClick={() => void transitionTo(toStatus)}
                  >
                    {busyAction === toStatus
                      ? 'Đang xử lý…'
                      : (STATUS_LABEL[toStatus] ?? toStatus)}
                  </button>
                ))}
              </div>
              {canCancel ? (
                <div
                  style={{
                    marginTop: 12,
                    maxWidth: 420,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <TextField
                    label="Lý do hủy"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Bắt buộc khi hủy đơn"
                  />
                  <button
                    type="button"
                    className="nx-btn nx-btn-danger nx-btn-sm"
                    disabled={Boolean(busyAction)}
                    onClick={() => void cancelOrder()}
                  >
                    {busyAction === 'cancel' ? 'Đang hủy…' : 'Hủy đơn'}
                  </button>
                </div>
              ) : null}
              {!canConfirm && nextStatuses.length === 0 && !canCancel ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  Không còn thao tác chuyển trạng thái.
                </p>
              ) : null}
            </div>

            <div>
              <div className="nx-card-title">Vận chuyển / kiện</div>
              {shipmentsLoading ? (
                <p className="nx-hint">Đang tải trạng thái kiện…</p>
              ) : packages.length === 0 ? (
                <p className="nx-hint">
                  {isPickup
                    ? 'Đơn nhận tại cửa hàng — không yêu cầu kiện vận chuyển.'
                    : 'Đơn chưa có kiện hàng nào.'}
                </p>
              ) : (
                <table className="nx-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Kiện</th>
                      <th>Trạng thái kiện</th>
                      <th>Vận chuyển</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const shipment = shipmentByPackage.get(pkg.id);
                      return (
                        <tr key={pkg.id}>
                          <td>{pkg.packageCode}</td>
                          <td>{pkg.status}</td>
                          <td>
                            {isPickup ? (
                              <Badge
                                tone={
                                  shipment
                                    ? (SHIPMENT_TONE[shipment.status] ??
                                      'neutral')
                                    : 'warning'
                                }
                              >
                                {shipment
                                  ? shipment.status
                                  : 'Chưa sẵn sàng nhận tại cửa hàng'}
                              </Badge>
                            ) : shipment ? (
                              <Badge
                                tone={
                                  SHIPMENT_TONE[shipment.status] ?? 'neutral'
                                }
                              >
                                {shipment.status}
                              </Badge>
                            ) : (
                              <span className="nx-hint">Chưa tạo kiện</span>
                            )}
                          </td>
                          <td>
                            {!shipment && !isPickup ? (
                              <button
                                type="button"
                                className="nx-btn nx-btn-ghost"
                                disabled={creatingPackageId === pkg.id}
                                onClick={() => void createShipment(pkg)}
                              >
                                {creatingPackageId === pkg.id
                                  ? 'Đang tạo…'
                                  : 'Tạo kiện'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
