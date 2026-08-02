'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

function SupportPageInner() {
  const search = useSearchParams();
  const showCreate = search.get('tao') === '1';
  const [items, setItems] = useState<unknown[]>([]);
  const [orders, setOrders] = useState<
    Array<{ id: string; orderCode?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(showCreate);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState('ORDER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      bff.get('/api/bff/support/support/tickets'),
      bff.get('/api/bff/order/orders').catch(() => ({ items: [] })),
    ])
      .then(([ticketsData, ordersData]) => {
        const list = Array.isArray(ticketsData)
          ? ticketsData
          : ((ticketsData as { items?: unknown[] })?.items ?? []);
        setItems(list);
        const orderList = Array.isArray(ordersData)
          ? ordersData
          : ((ordersData as { items?: unknown[] })?.items ?? []);
        setOrders(orderList as Array<{ id: string; orderCode?: string }>);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showCreate) setCreating(true);
  }, [showCreate]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (subject.trim().length < 5 || description.trim().length < 10) {
      setFormError('Tiêu đề tối thiểu 5 ký tự và mô tả tối thiểu 10 ký tự.');
      return;
    }
    setSaving(true);
    try {
      await bff.post('/api/bff/support/support/tickets', {
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority: 'NORMAL',
        orderId: orderId || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setCreating(false);
      setSubject('');
      setDescription('');
      setOrderId('');
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được phiếu hỗ trợ'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        aria-busy="true"
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description={error}
        action={
          <button
            type="button"
            className="nt-btn nt-btn-primary"
            onClick={load}
          >
            Thử lại
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Hỗ trợ</h2>
        <button
          type="button"
          className="nt-btn nt-btn-primary"
          onClick={() => setCreating(true)}
        >
          Tạo phiếu hỗ trợ
        </button>
      </div>

      {creating ? (
        <form
          onSubmit={onCreate}
          style={{
            border: '1px solid #dbeafe',
            borderRadius: 12,
            padding: '1rem',
            marginBottom: '1rem',
            background: '#fff',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <label>
            Danh mục
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ORDER">Đơn hàng</option>
              <option value="PRODUCT">Sản phẩm</option>
              <option value="PAYMENT">Thanh toán</option>
              <option value="SHIPPING">Vận chuyển</option>
              <option value="WARRANTY">Bảo hành</option>
              <option value="ACCOUNT">Tài khoản</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>
          <label>
            Tiêu đề
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={5}
            />
          </label>
          <label>
            Nội dung
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              minLength={10}
            />
          </label>
          <label>
            Đơn hàng (tùy chọn)
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">— Không liên kết —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderCode ?? o.id}
                </option>
              ))}
            </select>
          </label>
          {formError ? (
            <p role="alert" style={{ color: '#b91c1c' }}>
              {formError}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              className="nt-btn nt-btn-primary"
              disabled={saving}
            >
              {saving ? 'Đang gửi…' : 'Gửi phiếu'}
            </button>
            <button
              type="button"
              className="nt-btn nt-btn-ghost"
              onClick={() => setCreating(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 && !creating ? (
        <EmptyState
          title="Hỗ trợ"
          description="Bạn chưa có phiếu hỗ trợ."
          action={
            <button
              type="button"
              className="nt-btn nt-btn-primary"
              onClick={() => setCreating(true)}
            >
              Tạo phiếu hỗ trợ
            </button>
          }
        />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {items.map((item, index) => {
            const record = item as Record<string, unknown>;
            const id = String(record.id ?? record.ticketNumber ?? index);
            const label = String(
              record.ticketNumber ?? record.subject ?? record.code ?? id,
            );
            return (
              <li
                key={id}
                style={{
                  border: '1px solid #dbeafe',
                  borderRadius: 12,
                  padding: '0.85rem',
                  background: '#fff',
                }}
              >
                <strong>{label}</strong>
                {record.status ? (
                  <div style={{ color: '#4b6478' }}>
                    Trạng thái: {String(record.status)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ marginTop: '1rem' }}>
        <Link href="/tai-khoan/don-hang">Xem đơn hàng</Link>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="nt-skeleton" style={{ minHeight: 160 }} aria-busy />
      }
    >
      <SupportPageInner />
    </Suspense>
  );
}
