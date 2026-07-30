'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { useAuth } from '../../components/providers/auth-provider';
import { useCart } from '../../components/providers/cart-provider';
import { EmptyState } from '../../components/common/empty-state';
import { bff, getErrorMessage } from '../../lib/api-browser';
import {
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../lib/constants';
import styles from './page.module.css';

type DeliveryMethod = 'STANDARD' | 'EXPRESS' | 'STORE_PICKUP';
type PaymentMethod = 'COD' | 'MOCK' | 'VNPAY';

interface CreatedOrder {
  id: string;
  code?: string;
  grandTotal?: number;
  totalAmount?: number;
}

interface CreatedPayment {
  id: string;
  status?: string;
  redirectUrl?: string;
  paymentUrl?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, subtotal, refresh } = useCart();
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/dang-nhap?next=/thanh-toan');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!cart || cart.items.length === 0) {
      setError('Giỏ hàng trống');
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const body: Record<string, unknown> = {
        idempotencyKey,
        deliveryMethod,
        paymentMethod,
      };
      if (deliveryMethod === 'STORE_PICKUP') {
        body['storeId'] = storeId;
      } else {
        body['shippingAddress'] = {
          recipientName,
          recipientPhone,
          line1,
          city,
        };
      }

      const order = await bff.post<CreatedOrder>('/api/bff/order/orders', body);
      const payment = await bff.post<CreatedPayment>(
        '/api/bff/payment/payments',
        {
          orderId: order.id,
          idempotencyKey: crypto.randomUUID(),
          method: paymentMethod,
        },
      );

      const redirect = payment.redirectUrl || payment.paymentUrl;
      if (paymentMethod === 'VNPAY' && redirect) {
        window.location.href = redirect;
        return;
      }

      const params = new URLSearchParams({
        orderId: order.id,
        status: 'success',
        paymentId: payment.id,
      });
      if (order.code) {
        params.set('code', order.code);
      }
      router.push(`/thanh-toan/ket-qua?${params.toString()}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tạo đơn hàng'));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || cartLoading) {
    return (
      <div
        className="nt-container nt-skeleton"
        style={{ minHeight: 240, margin: '2rem auto' }}
        aria-busy="true"
      />
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="nt-container" style={{ padding: '2rem 0' }}>
        <EmptyState
          title="Không có sản phẩm để thanh toán"
          description="Thêm sản phẩm vào giỏ trước khi checkout."
          action={
            <Link href="/gio-hang" className="nt-btn nt-btn-primary">
              Về giỏ hàng
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={`nt-container ${styles.root}`}>
      <h1 className={styles.title}>Thanh toán</h1>
      <p className={styles.note}>
        Tổng tiền cuối cùng do máy chủ tính lại. Không áp dụng voucher/mã giảm
        giá.
      </p>
      <form className={styles.layout} onSubmit={onSubmit}>
        <div className={styles.panel}>
          <h2>Phương thức giao hàng</h2>
          {(Object.keys(DELIVERY_METHOD_LABELS) as DeliveryMethod[]).map(
            (method) => (
              <label key={method} className={styles.radio}>
                <input
                  type="radio"
                  name="delivery"
                  checked={deliveryMethod === method}
                  onChange={() => setDeliveryMethod(method)}
                />
                {DELIVERY_METHOD_LABELS[method]}
              </label>
            ),
          )}

          {deliveryMethod === 'STORE_PICKUP' ? (
            <div className={styles.field}>
              <label htmlFor="storeId">Mã cửa hàng (storeId)</label>
              <input
                id="storeId"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor="recipientName">Người nhận</label>
                <input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="recipientPhone">Số điện thoại</label>
                <input
                  id="recipientPhone"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="line1">Địa chỉ</label>
                <input
                  id="line1"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="city">Tỉnh/Thành phố</label>
                <input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <h2>Thanh toán</h2>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
            (method) => (
              <label key={method} className={styles.radio}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                />
                {PAYMENT_METHOD_LABELS[method]}
              </label>
            ),
          )}
        </div>

        <aside className={styles.summary}>
          <h2>Tóm tắt đơn</h2>
          <ul className={styles.items}>
            {cart.items.map((item) => (
              <li key={item.skuId}>
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <strong>{formatVnd(item.lineSubtotal)}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.totalRow}>
            <span>Tạm tính (hiển thị)</span>
            <strong>{formatVnd(cart.subtotal ?? subtotal)}</strong>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="nt-btn nt-btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Đang tạo đơn…' : 'Đặt hàng'}
          </button>
        </aside>
      </form>
    </div>
  );
}
