'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { EmptyState } from '../../../../components/common/empty-state';
import { MediaThumb } from '../../../../components/media/media-thumb';
import { bff, getErrorMessage } from '../../../../lib/api-browser';
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../../../lib/constants';

interface OrderItem {
  id?: string;
  productName?: string;
  skuCode?: string;
  skuName?: string;
  quantity?: number;
  unitPrice?: number;
  lineSubtotal?: number;
  productId?: string;
  thumbnailUrl?: string;
  mediaId?: string;
}

function OrderItemReview({
  orderId,
  item,
  reviewed,
  onReviewed,
}: {
  orderId: string;
  item: OrderItem;
  reviewed: boolean;
  onReviewed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reviewed) {
    return (
      <span style={{ color: '#4b6478', fontSize: '0.9rem' }}>Đã đánh giá</span>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!item.id || content.trim().length < 10) {
      setError('Nội dung đánh giá tối thiểu 10 ký tự.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await bff.post('/api/bff/review/reviews', {
        orderId,
        orderItemId: item.id,
        rating,
        title: title.trim() || undefined,
        content: content.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      setOpen(false);
      setTitle('');
      setContent('');
      onReviewed();
    } catch (err) {
      setError(getErrorMessage(err, 'Không gửi được đánh giá'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="nt-btn nt-btn-ghost"
        onClick={() => setOpen(true)}
      >
        Viết đánh giá
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        marginTop: '0.65rem',
        display: 'grid',
        gap: '0.5rem',
        borderTop: '1px solid #e2e8f0',
        paddingTop: '0.65rem',
      }}
    >
      <label style={{ display: 'grid', gap: 4 }}>
        Điểm (1–5)
        <select
          className="nt-select"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          disabled={saving}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} sao
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Tiêu đề (tùy chọn)
        <input
          className="nt-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          maxLength={120}
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        Nội dung
        <textarea
          className="nt-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          required
          minLength={10}
          disabled={saving}
        />
      </label>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          className="nt-btn nt-btn-primary"
          disabled={saving}
        >
          {saving ? 'Đang gửi…' : 'Gửi đánh giá'}
        </button>
        <button
          type="button"
          className="nt-btn nt-btn-ghost"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [shipments, setShipments] = useState<unknown[]>([]);
  const [pickupStore, setPickupStore] = useState<{
    name?: string;
    address?: string;
    city?: string;
    phone?: string;
    openingHours?: string;
  } | null>(null);
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const orderId = params.id;

  const loadReviews = useCallback(async () => {
    try {
      const data = await bff.get<
        | Array<{ orderItemId?: string }>
        | { items?: Array<{ orderItemId?: string }> }
      >('/api/bff/review/reviews/me');
      const list = Array.isArray(data) ? data : (data.items ?? []);
      setReviewedItemIds(
        new Set(
          list
            .map((row) => String(row.orderItemId ?? '').trim())
            .filter(Boolean),
        ),
      );
    } catch {
      setReviewedItemIds(new Set());
    }
  }, []);

  useEffect(() => {
    Promise.all([
      bff.get<Record<string, unknown>>(`/api/bff/order/orders/${orderId}`),
      bff
        .get<
          unknown[]
        >(`/api/bff/shipping/shipping/shipments/by-order/${orderId}`)
        .catch(() => []),
    ])
      .then(async ([orderData, shipmentData]) => {
        setOrder(orderData);
        setShipments(Array.isArray(shipmentData) ? shipmentData : []);
        const storeId = orderData['pickupStoreId'];
        if (
          orderData['deliveryMethod'] === 'STORE_PICKUP' &&
          typeof storeId === 'string' &&
          storeId.length > 0
        ) {
          try {
            const store = await bff.get<Record<string, unknown>>(
              `/api/bff/inventory/stores/${storeId}`,
            );
            setPickupStore({
              name: String(store['name'] ?? ''),
              address: store['address'] ? String(store['address']) : undefined,
              city: store['city'] ? String(store['city']) : undefined,
              phone: store['phone'] ? String(store['phone']) : undefined,
              openingHours: store['openingHours']
                ? String(store['openingHours'])
                : undefined,
            });
          } catch {
            setPickupStore(null);
          }
        }
        if (orderData['status'] === 'DELIVERED') {
          await loadReviews();
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [orderId, loadReviews]);

  if (loading)
    return <div className="nt-skeleton" style={{ minHeight: 180 }} />;
  if (error || !order) {
    return (
      <EmptyState
        title="Không tìm thấy đơn"
        description={
          error ?? 'Đơn hàng không tồn tại hoặc bạn không có quyền xem.'
        }
        action={
          <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-primary">
            Danh sách đơn
          </Link>
        }
      />
    );
  }

  const status = String(order.status ?? '');
  const delivery = String(order.deliveryMethod ?? '');
  const isDelivered = status === 'DELIVERED';
  const isPickup = delivery === 'STORE_PICKUP';
  const code = String(
    order.orderCode ?? order.code ?? order.orderNumber ?? order.id,
  );
  const total = Number(order.grandTotal ?? order.totalAmount ?? 0);
  const subtotal = Number(order.merchandiseSubtotal ?? 0);
  const shippingFee = Number(order.shippingFee ?? 0);
  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  const address = order.shippingAddress as Record<string, unknown> | undefined;
  const paymentMethod = String(order.paymentMethod ?? '');
  const paymentStatus = String(order.paymentStatus ?? '');

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Đơn {code}</h2>
      <p>
        Trạng thái:{' '}
        <strong>{ORDER_STATUS_LABELS[status] ?? (status || '—')}</strong>
      </p>
      <p>
        Giao hàng:{' '}
        {DELIVERY_METHOD_LABELS[
          delivery as keyof typeof DELIVERY_METHOD_LABELS
        ] ?? delivery}{' '}
        · Thanh toán:{' '}
        {PAYMENT_METHOD_LABELS[
          paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
        ] ?? paymentMethod}{' '}
        ({paymentStatus || '—'})
      </p>

      <h3>Sản phẩm</h3>
      {items.length === 0 ? (
        <p style={{ color: '#4b6478' }}>Không có dòng sản phẩm.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          {items.map((item, i) => {
            const itemId = String(item.id ?? i);
            return (
              <li
                key={itemId}
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  border: '1px solid #dbeafe',
                  borderRadius: 12,
                  padding: '0.75rem',
                  background: '#fff',
                }}
              >
                <MediaThumb
                  mediaRef={item.mediaId ?? item.thumbnailUrl}
                  alt={item.productName ?? 'Sản phẩm'}
                />
                <div style={{ flex: 1 }}>
                  <strong>{item.productName ?? 'Sản phẩm'}</strong>
                  <div style={{ color: '#4b6478', fontSize: '0.9rem' }}>
                    SKU: {item.skuCode ?? '—'}
                    {item.skuName ? ` · ${item.skuName}` : ''}
                  </div>
                  <div>
                    SL: {item.quantity ?? 0} ×{' '}
                    {formatVnd(Number(item.unitPrice ?? 0))} ={' '}
                    <strong>{formatVnd(Number(item.lineSubtotal ?? 0))}</strong>
                  </div>
                  {isDelivered && item.id ? (
                    <OrderItemReview
                      orderId={orderId}
                      item={item}
                      reviewed={reviewedItemIds.has(item.id)}
                      onReviewed={() => {
                        setReviewedItemIds((prev) =>
                          new Set(prev).add(item.id!),
                        );
                        void loadReviews();
                      }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3>Tổng tiền</h3>
      <p>
        Tạm tính: {formatVnd(subtotal)}
        <br />
        Phí giao: {formatVnd(shippingFee)}
        <br />
        <strong>Tổng: {formatVnd(total)}</strong>
      </p>

      <h3>{isPickup ? 'Nhận tại cửa hàng' : 'Địa chỉ giao hàng'}</h3>
      {isPickup ? (
        <p style={{ color: '#4b6478' }}>
          <strong>{pickupStore?.name || 'Cửa hàng nhận hàng'}</strong>
          <br />
          {[pickupStore?.address, pickupStore?.city]
            .filter(Boolean)
            .join(', ') || '—'}
          {pickupStore?.phone ? (
            <>
              <br />
              ĐT: {pickupStore.phone}
            </>
          ) : null}
          {pickupStore?.openingHours ? (
            <>
              <br />
              Giờ: {pickupStore.openingHours}
            </>
          ) : null}
          <br />
          Trạng thái nhận hàng theo đơn — không tạo kiện vận chuyển.
        </p>
      ) : address ? (
        <p>
          {String(address.recipientName ?? '')} ·{' '}
          {String(address.recipientPhone ?? '')}
          <br />
          {String(
            address.fullText ??
              [
                address.line1,
                address.ward,
                address.district,
                address.city ?? address.province,
              ]
                .filter(Boolean)
                .join(', '),
          )}
        </p>
      ) : (
        <p style={{ color: '#4b6478' }}>Chưa có địa chỉ giao hàng.</p>
      )}

      <h3>Vận chuyển</h3>
      {isPickup ? (
        <p style={{ color: '#4b6478' }}>
          Đơn nhận tại cửa hàng — không có kiện vận chuyển.
        </p>
      ) : shipments.length === 0 ? (
        <p style={{ color: '#4b6478' }}>
          Chưa có kiện vận chuyển (đơn có thể đang chờ tạo kiện).
        </p>
      ) : (
        <ul>
          {shipments.map((s, i) => {
            const row = s as Record<string, unknown>;
            return (
              <li key={String(row.id ?? i)}>
                {String(row.shipmentCode ?? row.trackingCode ?? row.id)} —{' '}
                {String(row.status ?? '')}
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-ghost">
          Quay lại
        </Link>
        <Link href="/tai-khoan/thong-bao" className="nt-btn nt-btn-ghost">
          Thông báo
        </Link>
      </div>
    </div>
  );
}
