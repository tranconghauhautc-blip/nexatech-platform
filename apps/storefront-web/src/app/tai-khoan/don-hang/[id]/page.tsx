'use client';

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
  const total = Number(order.grandTotal ?? order.totalAmount ?? 0);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Đơn {String(order.code ?? order.id)}</h2>
      <p>Trạng thái: {ORDER_STATUS_LABELS[status] ?? status}</p>
      <p>
        Tổng: <strong>{formatVnd(total)}</strong>
      </p>
      <h3>Vận chuyển</h3>
      {shipments.length === 0 ? (
        <p style={{ color: '#4b6478' }}>Chưa có kiện vận chuyển.</p>
      ) : (
        <ul>
          {shipments.map((s, i) => {
            const row = s as Record<string, unknown>;
            return (
              <li key={String(row.id ?? i)}>
                {String(row.trackingCode ?? row.id)} —{' '}
                {String(row.status ?? '')}
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-ghost">
        Quay lại
      </Link>
    </div>
  );
}
