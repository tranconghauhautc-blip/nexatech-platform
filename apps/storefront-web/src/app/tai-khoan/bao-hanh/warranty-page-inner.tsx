'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { OrderItemThumb } from '../../../components/media/order-item-thumb';
import { bff, getErrorMessage } from '../../../lib/api-browser';

interface OrderItemOption {
  id: string;
  productName?: string;
  skuCode?: string;
  productId?: string;
  imageMediaId?: string;
}

interface OrderOption {
  id: string;
  orderCode?: string;
  status?: string;
  items?: OrderItemOption[];
}

type RequestKind = 'CLAIM' | 'RETURN';

interface UnifiedItem {
  kind: RequestKind;
  id: string;
  label: string;
  status?: string;
}

function asList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return (data as { items?: unknown[] })?.items ?? [];
}

export function WarrantyPageInner() {
  const search = useSearchParams();
  const showCreate = search.get('tao') === '1';
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(showCreate);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<RequestKind>('CLAIM');
  const [orderId, setOrderId] = useState('');
  const [orderItemId, setOrderItemId] = useState('');
  const [issueType, setIssueType] = useState('DEFECT');
  const [returnReason, setReturnReason] = useState('DEFECTIVE');
  const [desiredResolution, setDesiredResolution] = useState('REFUND');
  const [description, setDescription] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      bff.get('/api/bff/warranty/warranty/claims'),
      bff.get('/api/bff/warranty/returns'),
      bff.get('/api/bff/order/orders').catch(() => ({ items: [] })),
    ])
      .then(([claimsData, returnsData, ordersData]) => {
        const claims = asList(claimsData).map((item) => {
          const record = item as Record<string, unknown>;
          const id = String(
            record.id ?? record.claimNumber ?? crypto.randomUUID(),
          );
          return {
            kind: 'CLAIM' as const,
            id,
            label: String(
              record.claimNumber ?? record.code ?? record.productName ?? id,
            ),
            status: record.status ? String(record.status) : undefined,
          };
        });
        const returns = asList(returnsData).map((item) => {
          const record = item as Record<string, unknown>;
          const id = String(
            record.id ??
              record.returnCode ??
              record.code ??
              crypto.randomUUID(),
          );
          return {
            kind: 'RETURN' as const,
            id,
            label: String(
              record.returnCode ?? record.code ?? record.productName ?? id,
            ),
            status: record.status ? String(record.status) : undefined,
          };
        });
        setItems([...claims, ...returns]);
        const orderList = asList(ordersData);
        setOrders(orderList as OrderOption[]);
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

  const eligibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === 'DELIVERED' && (order.items?.length ?? 0) > 0,
      ),
    [orders],
  );

  const selectedOrder = eligibleOrders.find((o) => o.id === orderId);
  const orderItems = selectedOrder?.items ?? [];
  const selectedItem = orderItems.find((item) => item.id === orderItemId);
  const canCreate = eligibleOrders.length > 0;

  useEffect(() => {
    if (!canCreate && creating) {
      setCreating(false);
    }
  }, [canCreate, creating]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!orderId || !orderItemId || description.trim().length < 10) {
      setFormError(
        'Vui lòng chọn đơn, dòng sản phẩm và mô tả ít nhất 10 ký tự.',
      );
      return;
    }
    setSaving(true);
    try {
      if (requestKind === 'CLAIM') {
        await bff.post('/api/bff/warranty/warranty/claims', {
          orderId,
          orderItemId,
          issueType,
          description: description.trim(),
          idempotencyKey: crypto.randomUUID(),
        });
      } else {
        await bff.post('/api/bff/warranty/returns', {
          orderId,
          orderItemId,
          reason: returnReason,
          desiredResolution,
          quantity: 1,
          description: description.trim(),
          idempotencyKey: crypto.randomUUID(),
        });
      }
      setCreating(false);
      setOrderId('');
      setOrderItemId('');
      setDescription('');
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được yêu cầu'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="nt-skeleton" aria-busy="true" role="status">
        Đang tải bảo hành & đổi trả…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="nt-form-error">
        {error}
      </div>
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
        <h2 style={{ marginTop: 0 }}>Bảo hành & đổi trả</h2>
        <button
          type="button"
          className="nt-btn nt-btn-primary"
          disabled={!canCreate}
          title={
            canCreate
              ? undefined
              : 'Chỉ tạo yêu cầu khi có đơn hàng đã giao thành công'
          }
          onClick={() => setCreating(true)}
        >
          Tạo yêu cầu bảo hành/đổi trả
        </button>
      </div>

      {!canCreate ? (
        <p
          style={{
            color: '#4b6478',
            background: '#f8fbff',
            border: '1px solid #dbeafe',
            borderRadius: 12,
            padding: '0.85rem',
          }}
        >
          Bạn cần có ít nhất một đơn hàng đã giao thành công để tạo yêu cầu bảo
          hành hoặc đổi trả.{' '}
          <Link href="/tai-khoan/don-hang">Xem đơn hàng của tôi</Link>
        </p>
      ) : null}

      {creating && canCreate ? (
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
            Loại yêu cầu
            <select
              className="nt-select"
              value={requestKind}
              onChange={(e) => setRequestKind(e.target.value as RequestKind)}
              aria-label="Loại yêu cầu"
            >
              <option value="CLAIM">Bảo hành</option>
              <option value="RETURN">Đổi trả</option>
            </select>
          </label>
          <label>
            Đơn hàng đã giao
            <select
              className="nt-select"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setOrderItemId('');
              }}
              required
            >
              <option value="">— Chọn đơn —</option>
              {eligibleOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderCode ?? `Đơn ${o.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sản phẩm trong đơn
            <select
              className="nt-select"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
              required
              disabled={!orderId}
            >
              <option value="">— Chọn sản phẩm —</option>
              {orderItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.productName ?? item.skuCode ?? 'Sản phẩm'}
                </option>
              ))}
            </select>
          </label>
          {selectedItem ? (
            <div
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'center',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '0.5rem',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <OrderItemThumb
                  item={selectedItem}
                  alt={selectedItem.productName ?? 'Sản phẩm'}
                />
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                <strong>{selectedItem.productName ?? 'Sản phẩm'}</strong>
                <div style={{ color: '#4b6478' }}>
                  SKU: {selectedItem.skuCode ?? '—'}
                </div>
              </div>
            </div>
          ) : null}
          {requestKind === 'CLAIM' ? (
            <label>
              Loại sự cố
              <select
                className="nt-select"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
              >
                <option value="DEFECT">Lỗi sản xuất</option>
                <option value="MALFUNCTION">Hỏng / không hoạt động</option>
                <option value="MISSING_PARTS">Thiếu linh kiện</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Lý do đổi trả
                <select
                  className="nt-select"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  aria-label="Lý do đổi trả"
                >
                  <option value="DEFECTIVE">Sản phẩm lỗi</option>
                  <option value="WRONG_ITEM">Sai sản phẩm</option>
                  <option value="CHANGED_MIND">Đổi ý</option>
                  <option value="DAMAGED_SHIPPING">
                    Hư hỏng khi vận chuyển
                  </option>
                  <option value="OTHER">Khác</option>
                </select>
              </label>
              <label>
                Mong muốn xử lý
                <select
                  className="nt-select"
                  value={desiredResolution}
                  onChange={(e) => setDesiredResolution(e.target.value)}
                >
                  <option value="REFUND">Hoàn tiền</option>
                  <option value="EXCHANGE">Đổi sản phẩm</option>
                  <option value="STORE_CREDIT">Điểm/tín dụng cửa hàng</option>
                </select>
              </label>
            </>
          )}
          <label>
            Mô tả
            <textarea
              className="nt-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              minLength={10}
            />
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
              {saving ? 'Đang gửi…' : 'Gửi yêu cầu'}
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
          title="Bảo hành & đổi trả"
          description={
            canCreate
              ? 'Bạn chưa có yêu cầu bảo hành hoặc đổi trả.'
              : 'Bạn chưa có yêu cầu bảo hành hoặc đổi trả. Yêu cầu mới chỉ khả dụng với đơn hàng đã giao thành công.'
          }
          action={
            canCreate ? (
              <button
                type="button"
                className="nt-btn nt-btn-primary"
                onClick={() => setCreating(true)}
              >
                Tạo yêu cầu bảo hành/đổi trả
              </button>
            ) : (
              <Link
                href="/tai-khoan/don-hang"
                className="nt-btn nt-btn-primary"
              >
                Xem đơn hàng
              </Link>
            )
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
          {items.map((record) => (
            <li
              key={`${record.kind}-${record.id}`}
              style={{
                border: '1px solid #dbeafe',
                borderRadius: 12,
                padding: '0.85rem',
                background: '#fff',
              }}
            >
              <strong>{record.label}</strong>
              <div style={{ color: '#4b6478' }}>
                Loại: {record.kind === 'CLAIM' ? 'Bảo hành' : 'Đổi trả'}
              </div>
              {record.status ? (
                <div style={{ color: '#4b6478' }}>
                  Trạng thái: {record.status}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
