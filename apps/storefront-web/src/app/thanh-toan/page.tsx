'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  orderCode?: string;
  code?: string;
  grandTotal?: number;
  totalAmount?: number;
}

interface CreatedPayment {
  id: string;
  status?: string;
  redirectUrl?: string;
  paymentUrl?: string;
  checkoutUrl?: string;
}

interface SavedAddress {
  id: string;
  label?: string;
  recipient?: string;
  phone?: string;
  line1?: string;
  ward?: string;
  district?: string;
  city?: string;
  provinceName?: string;
  wardName?: string;
  isDefault?: boolean;
}

interface PickupStore {
  id: string;
  code?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  isActive?: boolean;
  pickupEnabled?: boolean;
}

function formatSavedAddress(a: SavedAddress): string {
  return [a.line1, a.wardName ?? a.ward, a.district, a.provinceName ?? a.city]
    .filter(Boolean)
    .join(', ');
}

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { cart, loading: cartLoading, subtotal, refresh } = useCart();
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [stores, setStores] = useState<PickupStore[]>([]);
  const [storeQuery, setStoreQuery] = useState('');
  const [pickupStoreId, setPickupStoreId] = useState('');
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

  useEffect(() => {
    if (!isAuthenticated) return;
    bff
      .get('/api/bff/customer/customers/me/addresses')
      .then((data) => {
        const list = Array.isArray(data)
          ? (data as SavedAddress[])
          : (((data as { items?: SavedAddress[] })?.items ??
              []) as SavedAddress[]);
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def?.id) setSelectedAddressId(def.id);
      })
      .catch(() => setAddresses([]));

    bff
      .get('/api/bff/inventory/stores/pickup')
      .then((data) => {
        const list = Array.isArray(data)
          ? (data as PickupStore[])
          : (((data as { items?: PickupStore[] })?.items ??
              []) as PickupStore[]);
        setStores(
          list.filter((s) => s.isActive !== false && s.pickupEnabled !== false),
        );
      })
      .catch(() => setStores([]));
  }, [isAuthenticated]);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q) ||
        (s.address ?? '').toLowerCase().includes(q) ||
        (s.code ?? '').toLowerCase().includes(q),
    );
  }, [stores, storeQuery]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!cart || cart.items.length === 0) {
      setError('Giỏ hàng trống');
      return;
    }
    if (deliveryMethod === 'STORE_PICKUP') {
      if (!pickupStoreId) {
        setError('Vui lòng chọn cửa hàng nhận hàng.');
        return;
      }
    } else if (!selectedAddress) {
      setError('Vui lòng chọn địa chỉ giao hàng hoặc thêm địa chỉ mới.');
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
      if (user?.email) {
        body['customerEmail'] = user.email;
      }
      if (deliveryMethod === 'STORE_PICKUP') {
        body['pickupStoreId'] = pickupStoreId;
      } else if (selectedAddress) {
        body['shippingAddress'] = {
          recipientName: selectedAddress.recipient,
          recipientPhone: selectedAddress.phone,
          line1: selectedAddress.line1,
          ward: selectedAddress.wardName ?? selectedAddress.ward,
          district: selectedAddress.district,
          city: selectedAddress.provinceName ?? selectedAddress.city ?? '',
          province: selectedAddress.provinceName ?? selectedAddress.city,
        };
        body['city'] =
          selectedAddress.provinceName ?? selectedAddress.city ?? '';
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

      await refresh();

      const redirect =
        payment.redirectUrl || payment.paymentUrl || payment.checkoutUrl;
      if (paymentMethod === 'VNPAY' && redirect) {
        window.location.href = redirect;
        return;
      }

      const code = order.orderCode ?? order.code;
      const params = new URLSearchParams({
        orderId: order.id,
        status: 'success',
        paymentId: payment.id,
      });
      if (code) params.set('code', code);
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
        role="status"
        aria-busy="true"
      >
        Đang tải thanh toán…
      </div>
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
              <label htmlFor="storeSearch">Chọn cửa hàng nhận hàng</label>
              <input
                id="storeSearch"
                className="nt-input"
                type="search"
                placeholder="Tìm theo tên, địa chỉ…"
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                aria-label="Tìm cửa hàng"
              />
              {filteredStores.length === 0 ? (
                <p className={styles.error} role="status">
                  Không có cửa hàng nhận hàng khả dụng.
                </p>
              ) : (
                <div
                  role="listbox"
                  aria-label="Danh sách cửa hàng"
                  style={{
                    display: 'grid',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                  }}
                >
                  {filteredStores.map((store) => (
                    <label
                      key={store.id}
                      className={styles.radio}
                      style={{
                        border:
                          pickupStoreId === store.id
                            ? '2px solid #0b6bcb'
                            : '1px solid #dbeafe',
                        borderRadius: 10,
                        padding: '0.65rem 0.75rem',
                      }}
                    >
                      <input
                        type="radio"
                        name="pickupStore"
                        checked={pickupStoreId === store.id}
                        onChange={() => setPickupStoreId(store.id)}
                      />
                      <span>
                        <strong>{store.name}</strong>
                        <br />
                        <span style={{ color: '#4b6478', fontSize: '0.9rem' }}>
                          {[store.address, store.city]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                        {store.phone ? (
                          <>
                            <br />
                            <span
                              style={{ color: '#4b6478', fontSize: '0.9rem' }}
                            >
                              ĐT: {store.phone}
                            </span>
                          </>
                        ) : null}
                        {store.openingHours ? (
                          <>
                            <br />
                            <span
                              style={{ color: '#4b6478', fontSize: '0.9rem' }}
                            >
                              Giờ: {store.openingHours}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <label htmlFor="addressId">Địa chỉ giao hàng</label>
              {addresses.length === 0 ? (
                <p>
                  Chưa có địa chỉ đã lưu.{' '}
                  <Link href="/tai-khoan/ho-so">Thêm địa chỉ</Link>
                </p>
              ) : (
                <select
                  id="addressId"
                  className="nt-select"
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  required
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.label ?? 'Địa chỉ') +
                        (a.isDefault ? ' (mặc định)' : '') +
                        ' — ' +
                        formatSavedAddress(a)}
                    </option>
                  ))}
                </select>
              )}
              {selectedAddress ? (
                <p style={{ color: '#4b6478', marginTop: '0.5rem' }}>
                  {selectedAddress.recipient} · {selectedAddress.phone}
                  <br />
                  {formatSavedAddress(selectedAddress)}
                </p>
              ) : null}
              <p style={{ marginTop: '0.5rem' }}>
                <Link href="/tai-khoan/ho-so">Quản lý địa chỉ</Link>
              </p>
            </div>
          )}

          <h2>Phương thức thanh toán</h2>
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
          {paymentMethod === 'VNPAY' ? (
            <p className={styles.note}>
              VNPay Sandbox chỉ hoàn tất khi đã cấu hình credential thật. Không
              giả báo thành công nếu thiếu cấu hình.
            </p>
          ) : null}
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
