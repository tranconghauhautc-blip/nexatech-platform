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
import { MediaThumb } from '../../../components/ui/MediaThumb';
import { ErrorState, LoadingState } from '../../../components/ui/states';
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
  OUT_FOR_DELIVERY: 'info',
  PICKED_UP: 'info',
  READY_FOR_PICKUP: 'info',
  BOOKED: 'info',
  CREATED: 'neutral',
  QUOTED: 'neutral',
  DELIVERY_FAILED: 'danger',
  RETURN_TO_SENDER: 'warning',
  RETURNED: 'neutral',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

const PACKAGE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  ALLOCATED: 'Đã phân bổ',
  READY_TO_SHIP: 'Sẵn sàng giao',
  SHIPPED: 'Đã giao vận',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

const PACKAGE_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  ALLOCATED: 'info',
  READY_TO_SHIP: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  CREATED: 'Đã tạo kiện',
  QUOTED: 'Đã báo giá',
  BOOKED: 'Đã đặt vận chuyển',
  READY_FOR_PICKUP: 'Sẵn sàng nhận tại cửa hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERY_FAILED: 'Giao thất bại',
  RETURN_TO_SENDER: 'Đang hoàn trả',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Đã hoàn trả',
};

/** Nhãn nút chuyển trạng thái ĐƠN theo phương thức giao hàng — STORE_PICKUP
 * dùng luồng nhận tại cửa hàng riêng (book/ready-for-pickup/confirm-pickup)
 * nên không hiển thị nút SHIPPED/DELIVERED thủ công. */
const TRANSITION_LABEL_BY_METHOD: Record<string, Record<string, string>> = {
  STANDARD: {
    PROCESSING: 'Đang xử lý',
    READY_TO_SHIP: 'Sẵn sàng giao',
    SHIPPED: 'Đã giao vận',
    DELIVERED: 'Đã giao',
  },
  EXPRESS: {
    PROCESSING: 'Đang xử lý',
    READY_TO_SHIP: 'Sẵn sàng giao',
    SHIPPED: 'Đã giao vận',
    DELIVERED: 'Đã giao',
  },
  STORE_PICKUP: {
    PROCESSING: 'Đang chuẩn bị',
    READY_TO_SHIP: 'Sẵn sàng nhận tại cửa hàng',
  },
};

/** Bước tiếp theo "happy path" của shipment — dùng để gợi ý nút hành động
 * đơn giản (không cover các nhánh lỗi/hoàn trả, các nhánh đó xử lý riêng). */
const SHIPMENT_NEXT_STEP: Record<string, string> = {
  BOOKED: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  MOCK: 'Thanh toán thử nghiệm (Mock)',
  VNPAY: 'VNPay',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PENDING: 'Đang chờ thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
  REFUND_PENDING: 'Đang hoàn tiền',
};

const PAYMENT_STATUS_TONE: Record<string, BadgeTone> = {
  UNPAID: 'neutral',
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  REFUND_PENDING: 'warning',
};

const DELIVERY_METHOD_LABEL: Record<string, string> = {
  STANDARD: 'Giao hàng tiêu chuẩn',
  EXPRESS: 'Giao hàng nhanh',
  STORE_PICKUP: 'Nhận tại cửa hàng',
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
  deliveryMethod?: string;
  trackingCode?: string;
  pickupCodeHint?: string;
}

interface StoreOption {
  id: string;
  code?: string;
  name?: string;
}

interface OrderItemRow {
  id: string;
  skuCode?: string;
  skuName?: string;
  productName?: string;
  variantAttributes?: Record<string, string>;
  unitPrice?: number;
  quantity?: number;
  lineSubtotal?: number;
  currency?: string;
  imageMediaId?: string;
}

interface OrderStatusHistoryRow {
  id: string;
  fromStatus?: string;
  toStatus: string;
  actorType?: string;
  reason?: string;
  createdAt: string;
}

function formatVariant(attrs?: Record<string, string>): string {
  if (!attrs || Object.keys(attrs).length === 0) return '—';
  return Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
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
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(
    null,
  );
  const [busyShipmentId, setBusyShipmentId] = useState<string | null>(null);
  const [pickupCodeInputs, setPickupCodeInputs] = useState<
    Record<string, string>
  >({});
  const [revealedPickupCode, setRevealedPickupCode] = useState<{
    shipmentId: string;
    code: string;
  } | null>(null);
  const [history, setHistory] = useState<OrderStatusHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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
    setShipmentsError(null);
    try {
      const rows = await bffRequest<ShipmentRow[]>(
        'shipping',
        `shipments/order/${orderId}`,
      );
      setShipments(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setShipments([]);
      setShipmentsError(
        getErrorMessage(err, 'Không tải được trạng thái vận chuyển'),
      );
    } finally {
      setShipmentsLoading(false);
    }
  }

  async function loadHistory(orderId: string) {
    setHistoryLoading(true);
    try {
      const rows = await bffRequest<OrderStatusHistoryRow[]>(
        'order',
        `orders/${orderId}/status-history`,
      );
      setHistory(Array.isArray(rows) ? rows : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
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
    setShipmentsError(null);
    setHistory([]);
    setRevealedPickupCode(null);
    setPickupCodeInputs({});
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'order',
        `admin/orders/${orderId}`,
      );
      setDetail(data ?? row);
      await Promise.all([loadShipments(orderId), loadHistory(orderId)]);
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
    setShipmentsError(null);
    setHistory([]);
    setCancelReason('');
    setBusyAction(null);
    setRevealedPickupCode(null);
    setPickupCodeInputs({});
  }

  async function refreshSelected() {
    if (!selectedId) return;
    const data = await bffRequest<Record<string, unknown>>(
      'order',
      `admin/orders/${selectedId}`,
    );
    setDetail(data);
    await Promise.all([loadShipments(selectedId), loadHistory(selectedId)]);
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
          idempotencyKey: `admin-ship-${pkg.id}-${Date.now()}`,
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

  async function bookShipmentAction(shipment: ShipmentRow) {
    setBusyShipmentId(shipment.id);
    try {
      await bffRequest('shipping', `shipments/${shipment.id}/book`, {
        method: 'POST',
        body: { idempotencyKey: `admin-book-${shipment.id}-${Date.now()}` },
      });
      showToast('Đã đặt vận chuyển kiện hàng', 'success');
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Đặt vận chuyển thất bại'), 'error');
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function advanceShipmentAction(shipment: ShipmentRow) {
    const toStatus = SHIPMENT_NEXT_STEP[shipment.status];
    if (!toStatus) return;
    setBusyShipmentId(shipment.id);
    try {
      await bffRequest(
        'shipping',
        `shipments/${shipment.id}/status-transitions`,
        {
          method: 'POST',
          body: {
            toStatus,
            idempotencyKey: `admin-advance-${shipment.id}-${toStatus}-${Date.now()}`,
          },
        },
      );
      showToast(
        `Đã cập nhật vận chuyển: ${SHIPMENT_STATUS_LABEL[toStatus] ?? toStatus}`,
        'success',
      );
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cập nhật vận chuyển thất bại'), 'error');
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function readyForPickupAction(shipment: ShipmentRow) {
    setBusyShipmentId(shipment.id);
    try {
      const result = await bffRequest<{ pickupCode?: string }>(
        'shipping',
        `shipments/${shipment.id}/ready-for-pickup`,
        {
          method: 'POST',
          body: {
            idempotencyKey: `admin-ready-${shipment.id}-${Date.now()}`,
          },
        },
      );
      if (result?.pickupCode) {
        setRevealedPickupCode({
          shipmentId: shipment.id,
          code: result.pickupCode,
        });
      }
      showToast('Đã sẵn sàng cho khách nhận tại cửa hàng', 'success');
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Chuyển sẵn sàng nhận thất bại'), 'error');
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function confirmPickupAction(shipment: ShipmentRow) {
    const pickupCode = (pickupCodeInputs[shipment.id] ?? '').trim();
    if (!pickupCode) {
      showToast('Nhập mã nhận hàng khách cung cấp', 'error');
      return;
    }
    setBusyShipmentId(shipment.id);
    try {
      await bffRequest('shipping', `shipments/${shipment.id}/confirm-pickup`, {
        method: 'POST',
        body: {
          pickupCode,
          idempotencyKey: `admin-confirm-${shipment.id}-${Date.now()}`,
        },
      });
      showToast('Đã xác nhận khách nhận hàng', 'success');
      setPickupCodeInputs((prev) => ({ ...prev, [shipment.id]: '' }));
      setRevealedPickupCode(null);
      await refreshSelected();
    } catch (err) {
      showToast(getErrorMessage(err, 'Mã nhận hàng không hợp lệ'), 'error');
    } finally {
      setBusyShipmentId(null);
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
  const orderItems = Array.isArray(detail?.['items'])
    ? (detail!['items'] as OrderItemRow[])
    : [];
  const shippingAddress = detail?.['shippingAddress'] as
    | { fullText?: string; recipientName?: string; recipientPhone?: string }
    | undefined;
  const customerSnapshot = detail?.['customerSnapshot'] as
    | { displayName?: string; email?: string; phone?: string }
    | undefined;
  const shipmentByPackage = useMemo(() => {
    const map = new Map<string, ShipmentRow>();
    for (const s of shipments) map.set(s.packageId, s);
    return map;
  }, [shipments]);
  const activePackages = packages.filter((p) => p.status !== 'CANCELLED');
  const packagesReadyForShipped =
    activePackages.length === 0 ||
    activePackages.every((p) =>
      ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(p.status),
    );
  const packagesAllDelivered =
    activePackages.length === 0 ||
    activePackages.every((p) => p.status === 'DELIVERED');
  const rawNextStatuses = TRANSITIONS[status] ?? [];
  const nextStatuses = isPickup
    ? rawNextStatuses.filter((s) => s !== 'SHIPPED' && s !== 'DELIVERED')
    : rawNextStatuses;
  const canConfirm = CONFIRMABLE.has(status);
  const canCancel = CANCELLABLE.has(status);
  const transitionLabels =
    TRANSITION_LABEL_BY_METHOD[deliveryMethod] ??
    TRANSITION_LABEL_BY_METHOD.STANDARD;

  function shipmentActionCell(pkg: OrderPackageRow, shipment?: ShipmentRow) {
    const busy = busyShipmentId === shipment?.id;
    if (!shipment) {
      return (
        <button
          type="button"
          className="nx-btn nx-btn-ghost nx-btn-sm"
          disabled={creatingPackageId === pkg.id}
          onClick={() => void createShipment(pkg)}
        >
          {creatingPackageId === pkg.id
            ? 'Đang tạo…'
            : isPickup
              ? 'Tạo kiện nhận hàng'
              : 'Tạo kiện'}
        </button>
      );
    }

    if (shipment.status === 'CREATED' || shipment.status === 'QUOTED') {
      return (
        <button
          type="button"
          className="nx-btn nx-btn-ghost nx-btn-sm"
          disabled={busy}
          onClick={() => void bookShipmentAction(shipment)}
        >
          {busy ? 'Đang đặt…' : 'Đặt vận chuyển'}
        </button>
      );
    }

    if (shipment.status === 'BOOKED' && isPickup) {
      return (
        <button
          type="button"
          className="nx-btn nx-btn-ghost nx-btn-sm"
          disabled={busy}
          onClick={() => void readyForPickupAction(shipment)}
        >
          {busy ? 'Đang xử lý…' : 'Sẵn sàng nhận tại cửa hàng'}
        </button>
      );
    }

    if (shipment.status === 'READY_FOR_PICKUP' && isPickup) {
      const revealed =
        revealedPickupCode?.shipmentId === shipment.id
          ? revealedPickupCode.code
          : undefined;
      return (
        <div style={{ display: 'grid', gap: 6, minWidth: 200 }}>
          {revealed ? (
            <p className="nx-hint" style={{ margin: 0 }}>
              Mã nhận hàng (báo cho khách):{' '}
              <strong style={{ letterSpacing: 1 }}>{revealed}</strong>
            </p>
          ) : shipment.pickupCodeHint ? (
            <p className="nx-hint" style={{ margin: 0 }}>
              Mã nhận hàng: {shipment.pickupCodeHint}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="nx-input"
              placeholder="Mã khách cung cấp"
              value={pickupCodeInputs[shipment.id] ?? ''}
              onChange={(e) =>
                setPickupCodeInputs((prev) => ({
                  ...prev,
                  [shipment.id]: e.target.value,
                }))
              }
              style={{ maxWidth: 130 }}
            />
            <button
              type="button"
              className="nx-btn nx-btn-primary nx-btn-sm"
              disabled={busy}
              onClick={() => void confirmPickupAction(shipment)}
            >
              {busy ? 'Đang xác nhận…' : 'Khách đã nhận'}
            </button>
          </div>
        </div>
      );
    }

    if (!isPickup && SHIPMENT_NEXT_STEP[shipment.status]) {
      const next = SHIPMENT_NEXT_STEP[shipment.status];
      return (
        <button
          type="button"
          className="nx-btn nx-btn-ghost nx-btn-sm"
          disabled={busy}
          onClick={() => void advanceShipmentAction(shipment)}
        >
          {busy
            ? 'Đang cập nhật…'
            : `Đánh dấu: ${SHIPMENT_STATUS_LABEL[next] ?? next}`}
        </button>
      );
    }

    return null;
  }

  function shipmentStatusBadge(pkg: OrderPackageRow, shipment?: ShipmentRow) {
    if (pkg.status === 'DELIVERED' && !shipment) {
      return <Badge tone="success">Đã hoàn tất</Badge>;
    }
    if (shipment) {
      return (
        <Badge tone={SHIPMENT_TONE[shipment.status] ?? 'neutral'}>
          {SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
        </Badge>
      );
    }
    if (isPickup) {
      return <Badge tone="warning">Chưa tạo kiện nhận hàng</Badge>;
    }
    return <span className="nx-hint">Chưa tạo kiện</span>;
  }

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
        size="lg"
        title={
          detail
            ? String(detail['orderCode'] ?? detail['code'] ?? 'Chi tiết đơn')
            : 'Chi tiết đơn'
        }
        onClose={closeDrawer}
      >
        {detailLoading ? (
          <LoadingState label="Đang tải chi tiết đơn hàng…" />
        ) : detailError ? (
          <ErrorState
            description={detailError}
            onRetry={() => selectedId && void openOrder({ id: selectedId })}
          />
        ) : detail ? (
          <div style={{ padding: '0 4px 16px', display: 'grid', gap: 16 }}>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
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
              <dt className="nx-hint">Khách hàng</dt>
              <dd style={{ margin: 0 }}>
                {customerSnapshot?.displayName || '—'}
                {customerSnapshot?.email ? (
                  <div className="nx-hint">{customerSnapshot.email}</div>
                ) : null}
                {customerSnapshot?.phone ? (
                  <div className="nx-hint">{customerSnapshot.phone}</div>
                ) : null}
              </dd>
              <dt className="nx-hint">Giao hàng</dt>
              <dd style={{ margin: 0 }}>
                {DELIVERY_METHOD_LABEL[deliveryMethod] ?? deliveryMethod ?? '—'}
              </dd>
              {isPickup ? (
                <>
                  <dt className="nx-hint">Cửa hàng nhận</dt>
                  <dd style={{ margin: 0 }} title={pickupStoreId || undefined}>
                    {pickupStoreLabel}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="nx-hint">Địa chỉ giao</dt>
                  <dd style={{ margin: 0 }}>
                    {shippingAddress?.fullText || '—'}
                  </dd>
                </>
              )}
              <dt className="nx-hint">Thanh toán</dt>
              <dd style={{ margin: 0 }}>
                {PAYMENT_METHOD_LABEL[String(detail['paymentMethod'] ?? '')] ??
                  String(detail['paymentMethod'] ?? '—')}
                {' · '}
                <Badge
                  tone={
                    PAYMENT_STATUS_TONE[
                      String(detail['paymentStatus'] ?? '')
                    ] ?? 'neutral'
                  }
                >
                  {PAYMENT_STATUS_LABEL[
                    String(detail['paymentStatus'] ?? '')
                  ] ?? String(detail['paymentStatus'] ?? '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Tạo lúc</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Sản phẩm</div>
              <table className="nx-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Sản phẩm</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <MediaThumb
                          mediaRef={item.imageMediaId}
                          alt={item.productName ?? item.skuName ?? 'Sản phẩm'}
                        />
                      </td>
                      <td>
                        <div>{item.productName || item.skuName || '—'}</div>
                        <div className="nx-hint">
                          SKU: {item.skuCode ?? '—'} ·{' '}
                          {formatVariant(item.variantAttributes)}
                        </div>
                      </td>
                      <td>{item.quantity ?? '—'}</td>
                      <td>{formatMoney(item.unitPrice)}</td>
                      <td>{formatMoney(item.lineSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '4px 12px',
                  fontSize: 14,
                  margin: '12px 0 0',
                  maxWidth: 320,
                  marginLeft: 'auto',
                }}
              >
                <dt className="nx-hint">Tạm tính</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>
                  {formatMoney(detail['merchandiseSubtotal'])}
                </dd>
                <dt className="nx-hint">Phí vận chuyển</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>
                  {formatMoney(detail['shippingFee'])}
                </dd>
                <dt className="nx-hint">Giảm giá</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>
                  -{formatMoney(detail['discountTotal'])}
                </dd>
                <dt>
                  <strong>Tổng cộng</strong>
                </dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>
                  <strong>{formatMoney(detail['grandTotal'])}</strong>
                </dd>
              </dl>
            </div>

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
                {nextStatuses.map((toStatus) => {
                  const blockedShipped =
                    !isPickup &&
                    toStatus === 'SHIPPED' &&
                    !packagesReadyForShipped;
                  const blockedDelivered =
                    !isPickup &&
                    toStatus === 'DELIVERED' &&
                    !packagesAllDelivered;
                  const disabled =
                    Boolean(busyAction) || blockedShipped || blockedDelivered;
                  return (
                    <button
                      key={toStatus}
                      type="button"
                      className="nx-btn nx-btn-secondary nx-btn-sm"
                      disabled={disabled}
                      title={
                        blockedShipped
                          ? 'Cần kiện hàng ở trạng thái Sẵn sàng giao trở lên'
                          : blockedDelivered
                            ? 'Cần tất cả kiện hàng ở trạng thái Đã giao'
                            : undefined
                      }
                      onClick={() => void transitionTo(toStatus)}
                    >
                      {busyAction === toStatus
                        ? 'Đang xử lý…'
                        : (transitionLabels[toStatus] ??
                          STATUS_LABEL[toStatus] ??
                          toStatus)}
                    </button>
                  );
                })}
              </div>
              {(status === 'READY_TO_SHIP' && !packagesReadyForShipped) ||
              (status === 'SHIPPED' && !packagesAllDelivered) ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  {isPickup
                    ? 'Đơn nhận tại cửa hàng: dùng luồng "Vận chuyển / kiện" bên dưới để đặt vận chuyển, sẵn sàng nhận và xác nhận khách đã nhận.'
                    : 'Cập nhật kiện hàng ở mục "Vận chuyển / kiện" bên dưới trước khi chuyển đơn sang bước tiếp theo.'}
                </p>
              ) : null}
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
                <LoadingState label="Đang tải trạng thái kiện…" />
              ) : shipmentsError ? (
                <ErrorState
                  description={shipmentsError}
                  onRetry={() => selectedId && void loadShipments(selectedId)}
                />
              ) : packages.length === 0 ? (
                <p className="nx-hint">
                  {isPickup
                    ? 'Đơn nhận tại cửa hàng — chưa có kiện hàng nào.'
                    : 'Đơn chưa có kiện hàng nào.'}
                </p>
              ) : (
                <table className="nx-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Kiện</th>
                      <th>Trạng thái kiện</th>
                      <th>Vận chuyển</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const shipment = shipmentByPackage.get(pkg.id);
                      return (
                        <tr key={pkg.id}>
                          <td>
                            {pkg.packageCode}
                            {shipment?.trackingCode ? (
                              <div className="nx-hint">
                                Mã vận đơn: {shipment.trackingCode}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <Badge
                              tone={
                                PACKAGE_STATUS_TONE[pkg.status] ?? 'neutral'
                              }
                            >
                              {PACKAGE_STATUS_LABEL[pkg.status] ?? pkg.status}
                            </Badge>
                          </td>
                          <td>{shipmentStatusBadge(pkg, shipment)}</td>
                          <td>{shipmentActionCell(pkg, shipment)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <div className="nx-card-title">Lịch sử trạng thái</div>
              {historyLoading ? (
                <LoadingState label="Đang tải lịch sử…" />
              ) : history.length === 0 ? (
                <p className="nx-hint">Chưa có lịch sử chuyển trạng thái.</p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '8px 0 0',
                    padding: 0,
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  {history.map((h) => (
                    <li
                      key={h.id}
                      style={{
                        fontSize: 13,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                      }}
                    >
                      <span className="nx-hint" style={{ minWidth: 140 }}>
                        {formatDateTime(h.createdAt)}
                      </span>
                      <span>
                        {h.fromStatus
                          ? `${STATUS_LABEL[h.fromStatus] ?? h.fromStatus} → `
                          : ''}
                        <strong>
                          {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                        </strong>
                        {h.reason ? ` — ${h.reason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
