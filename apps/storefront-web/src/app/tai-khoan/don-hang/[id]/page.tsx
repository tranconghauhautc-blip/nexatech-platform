'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [shipments, setShipments] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id;
    Promise.all([
      bff.get<Record<string, unknown>>(`/api/bff/order/orders/${id}`),
      bff
        .get<unknown[]>(`/api/bff/shipping/shipping/shipments/by-order/${id}`)
        .catch(() => []),
    ])
      .then(([orderData, shipmentData]) => {
        setOrder(orderData);
        setShipments(Array.isArray(shipmentData) ? shipmentData : []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [params.id]);

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
          {items.map((item, i) => (
            <li
              key={String(item.id ?? i)}
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
              </div>
            </li>
          ))}
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
          Cửa hàng: {String(order.pickupStoreId ?? '—')}
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
