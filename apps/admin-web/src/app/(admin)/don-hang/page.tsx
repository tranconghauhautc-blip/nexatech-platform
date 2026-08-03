'use client';

import { useMemo, useState } from 'react';
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
import { useToast } from '../../../components/ui/toast';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'AWAITING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'READY_TO_SHIP', label: 'Sẵn sàng giao' },
  { value: 'SHIPPED', label: 'Đã giao vận' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'grandTotal_desc', label: 'Tổng tiền giảm' },
  { value: 'grandTotal_asc', label: 'Tổng tiền tăng' },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  AWAITING_PAYMENT: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  READY_TO_SHIP: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
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

  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(
    null,
  );

  async function openOrder(row: Record<string, unknown>) {
    setSelected(row);
    setShipments([]);
    const orderId = String(row['id'] ?? '');
    if (!orderId) return;
    setShipmentsLoading(true);
    try {
      const rows = await bffRequest<ShipmentRow[]>(
        'shipping',
        `shipments/order/${orderId}`,
      );
      setShipments(Array.isArray(rows) ? rows : []);
    } catch {
      // Chưa có kiện nào hoặc shipping-service không phản hồi — coi như trống.
      setShipments([]);
    } finally {
      setShipmentsLoading(false);
    }
  }

  async function createShipment(pkg: OrderPackageRow) {
    if (!selected) return;
    const orderId = String(selected['id'] ?? '');
    setCreatingPackageId(pkg.id);
    try {
      await bffRequest('shipping', 'shipments', {
        method: 'POST',
        body: {
          orderId,
          packageId: pkg.id,
          idempotencyKey: `admin-ship-${pkg.id}`,
        },
      });
      showToast('Đã tạo kiện vận chuyển', 'success');
      const rows = await bffRequest<ShipmentRow[]>(
        'shipping',
        `shipments/order/${orderId}`,
      );
      setShipments(Array.isArray(rows) ? rows : []);
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
              {status || '—'}
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
        render: (r) => {
          const total = r['grandTotal'];
          return typeof total === 'number'
            ? total.toLocaleString('vi-VN') + ' ₫'
            : String(total ?? '—');
        },
      },
      {
        key: 'createdAt',
        header: 'Tạo lúc',
        render: (r) => {
          const raw = r['createdAt'];
          if (typeof raw !== 'string') return '—';
          try {
            return new Date(raw).toLocaleString('vi-VN');
          } catch {
            return raw;
          }
        },
      },
    ],
    [],
  );

  const deliveryMethod = String(selected?.['deliveryMethod'] ?? '');
  const isPickup = deliveryMethod === 'STORE_PICKUP';
  const packages = Array.isArray(selected?.['packages'])
    ? (selected!['packages'] as OrderPackageRow[])
    : [];
  const shipmentByPackage = useMemo(() => {
    const map = new Map<string, ShipmentRow>();
    for (const s of shipments) map.set(s.packageId, s);
    return map;
  }, [shipments]);

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
        onReset={controls.reset}
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
        onRowClick={openOrder}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
      {selected ? (
        <div className="nx-panel" style={{ marginTop: 16 }}>
          <div className="nx-card-title">
            Chi tiết đơn{' '}
            {String(selected['orderCode'] ?? selected['code'] ?? '')}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="nx-card-title" style={{ fontSize: 13 }}>
              Vận chuyển{' '}
              {isPickup ? (
                <Badge tone="info">Nhận tại cửa hàng (STORE_PICKUP)</Badge>
              ) : (
                <Badge tone="neutral">{deliveryMethod || '—'}</Badge>
              )}
            </div>
            {isPickup ? (
              <p className="nx-hint" style={{ marginTop: 8 }}>
                Pickup storeId: {String(selected['pickupStoreId'] ?? '—')} —
                dùng tab Cửa hàng để xem tên/địa chỉ. Đơn pickup không bắt buộc
                có shipment.
              </p>
            ) : null}
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
                              tone={SHIPMENT_TONE[shipment.status] ?? 'neutral'}
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
                              onClick={() => createShipment(pkg)}
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

          <details style={{ marginTop: 16 }}>
            <summary className="nx-hint" style={{ cursor: 'pointer' }}>
              Xem dữ liệu đầy đủ (JSON)
            </summary>
            <pre
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(selected, null, 2)}
            </pre>
          </details>
          <button
            type="button"
            className="nx-btn nx-btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => setSelected(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}
    </div>
  );
}
