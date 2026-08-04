'use client';

import { SUPPORT_LIMITS } from '@nexatech/shared-contracts';
import { formatVnd } from '@nexatech/shared-web';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { OrderItemThumb } from '../../../components/media/order-item-thumb';
import { bff, getErrorMessage } from '../../../lib/api-browser';
import {
  ORDER_STATUS_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from '../../../lib/constants';

interface OrderItemOption {
  id: string;
  productName?: string;
  skuCode?: string;
  quantity?: number;
  productId?: string;
  imageMediaId?: string;
}

interface OrderOption {
  id: string;
  orderCode?: string;
  status?: string;
  createdAt?: string;
  grandTotal?: number;
  items?: OrderItemOption[];
}

interface TicketMessage {
  id: string;
  authorId: string;
  authorType: 'CUSTOMER' | 'STAFF';
  content: string;
  createdAt: string;
}

interface TicketRecord {
  id: string;
  ticketCode?: string;
  subject?: string;
  category?: string;
  status?: string;
  orderId?: string;
  description?: string;
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  messages?: TicketMessage[];
}

const CATEGORY_OPTIONS = Object.entries(SUPPORT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const CLOSED_STATUSES = new Set(['CLOSED', 'CANCELLED']);

function formatDateTime(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN');
  } catch {
    return value;
  }
}

function summarizeOrderItems(items: OrderItemOption[] | undefined): string {
  if (!items?.length) return 'Không có sản phẩm';
  const first =
    items[0]?.productName?.trim() || items[0]?.skuCode?.trim() || 'Sản phẩm';
  const extra = items.length - 1;
  return extra > 0 ? `${first} (+${extra})` : first;
}

function formatOrderOptionLabel(order: OrderOption): string {
  const code = order.orderCode?.trim();
  if (!code) return 'Đơn hàng (thiếu mã)';
  const date = formatDate(order.createdAt);
  const status = ORDER_STATUS_LABELS[order.status ?? ''] ?? order.status ?? '—';
  const items = summarizeOrderItems(order.items);
  const total =
    typeof order.grandTotal === 'number' ? formatVnd(order.grandTotal) : '—';
  return `${code} · ${date} · ${status} · ${items} · ${total}`;
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return SUPPORT_TICKET_STATUS_LABELS[status] ?? status;
}

function categoryLabel(category?: string): string {
  if (!category) return '—';
  return SUPPORT_CATEGORY_LABELS[category] ?? category;
}

function RequiredMark() {
  return (
    <span
      aria-hidden="true"
      style={{ color: 'var(--nt-danger)', marginLeft: 4 }}
    >
      *
    </span>
  );
}

function SupportPageInner() {
  const search = useSearchParams();
  const showCreate = search.get('tao') === '1';
  const [items, setItems] = useState<TicketRecord[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(showCreate);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [category, setCategory] = useState('ORDER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);

  const ordersById = useMemo(() => {
    const map = new Map<string, OrderOption>();
    for (const order of orders) map.set(order.id, order);
    return map;
  }, [orders]);

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
        setItems(list as TicketRecord[]);
        const orderList = Array.isArray(ordersData)
          ? ordersData
          : ((ordersData as { items?: unknown[] })?.items ?? []);
        setOrders(orderList as OrderOption[]);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showCreate) {
      setCreating(true);
      setSelectedId(null);
      setDetail(null);
    }
  }, [showCreate]);

  const loadDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setReplyError(null);
    setReplySuccess(null);
    try {
      const data = await bff.get(
        `/api/bff/support/support/tickets/${ticketId}`,
      );
      setDetail(data as TicketRecord);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết phiếu'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function resetCreateForm() {
    setCategory('ORDER');
    setSubject('');
    setDescription('');
    setOrderId('');
    setFieldErrors({});
    setFormError(null);
  }

  function openCreate() {
    setSelectedId(null);
    setDetail(null);
    setFormSuccess(null);
    resetCreateForm();
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
    resetCreateForm();
  }

  function validateCreate(): boolean {
    const next: Record<string, string> = {};
    const subjectTrim = subject.trim();
    const descriptionTrim = description.trim();
    if (subjectTrim.length < SUPPORT_LIMITS.SUBJECT_MIN) {
      next.subject = `Tiêu đề tối thiểu ${SUPPORT_LIMITS.SUBJECT_MIN} ký tự.`;
    } else if (subjectTrim.length > SUPPORT_LIMITS.SUBJECT_MAX) {
      next.subject = `Tiêu đề tối đa ${SUPPORT_LIMITS.SUBJECT_MAX} ký tự.`;
    }
    if (descriptionTrim.length < SUPPORT_LIMITS.DESCRIPTION_MIN) {
      next.description = `Nội dung tối thiểu ${SUPPORT_LIMITS.DESCRIPTION_MIN} ký tự.`;
    } else if (descriptionTrim.length > SUPPORT_LIMITS.DESCRIPTION_MAX) {
      next.description = `Nội dung tối đa ${SUPPORT_LIMITS.DESCRIPTION_MAX} ký tự.`;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!validateCreate()) return;
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
      closeCreate();
      setFormSuccess('Đã gửi phiếu hỗ trợ. Chúng tôi sẽ phản hồi sớm.');
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được phiếu hỗ trợ'));
    } finally {
      setSaving(false);
    }
  }

  async function onReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !detail) return;
    setReplyError(null);
    setReplySuccess(null);
    const content = reply.trim();
    if (content.length < SUPPORT_LIMITS.MESSAGE_MIN) {
      setReplyError('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    if (content.length > SUPPORT_LIMITS.MESSAGE_MAX) {
      setReplyError(`Tin nhắn tối đa ${SUPPORT_LIMITS.MESSAGE_MAX} ký tự.`);
      return;
    }
    setReplying(true);
    try {
      await bff.post(
        `/api/bff/support/support/tickets/${selectedId}/messages`,
        {
          content,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setReply('');
      setReplySuccess('Đã gửi phản hồi.');
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setReplyError(getErrorMessage(err, 'Không gửi được phản hồi'));
    } finally {
      setReplying(false);
    }
  }

  function openTicket(ticket: TicketRecord) {
    setCreating(false);
    setFormSuccess(null);
    setSelectedId(ticket.id);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    setReply('');
    setReplyError(null);
    setReplySuccess(null);
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        role="status"
        aria-busy="true"
      >
        Đang tải hỗ trợ…
      </div>
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

  if (selectedId) {
    const canReply = detail ? !CLOSED_STATUSES.has(detail.status ?? '') : false;
    const relatedOrder = detail?.orderId
      ? ordersById.get(detail.orderId)
      : undefined;
    const orderCode = relatedOrder?.orderCode?.trim();

    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>
            Chi tiết phiếu hỗ trợ
          </h2>
          <button
            type="button"
            className="nt-btn nt-btn-ghost"
            onClick={backToList}
          >
            ← Quay lại danh sách
          </button>
        </div>

        {detailLoading ? (
          <div
            className="nt-skeleton"
            style={{ minHeight: 200, marginTop: '1rem' }}
            role="status"
            aria-busy="true"
          >
            Đang tải phiếu…
          </div>
        ) : detailError ? (
          <EmptyState
            title="Không tải được phiếu"
            description={detailError}
            action={
              <button
                type="button"
                className="nt-btn nt-btn-primary"
                onClick={() => void loadDetail(selectedId)}
              >
                Thử lại
              </button>
            }
          />
        ) : detail ? (
          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            <div className="nt-card nt-card--pad">
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <strong style={{ fontSize: '1.05rem' }}>
                  {detail.ticketCode ?? detail.id}
                </strong>
                <span className="nt-badge nt-badge--info">
                  {statusLabel(detail.status)}
                </span>
                <span className="nt-badge">
                  {categoryLabel(detail.category)}
                </span>
              </div>
              <h3 style={{ margin: '0.75rem 0 0.35rem' }}>{detail.subject}</h3>
              <p
                style={{
                  margin: 0,
                  color: 'var(--nt-text-muted)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {detail.description}
              </p>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '0.35rem 1rem',
                  margin: '1rem 0 0',
                  fontSize: '0.9rem',
                }}
              >
                <dt className="nt-muted">Cập nhật</dt>
                <dd style={{ margin: 0 }}>
                  {formatDateTime(detail.updatedAt)}
                </dd>
                <dt className="nt-muted">Đơn liên quan</dt>
                <dd style={{ margin: 0 }}>
                  {orderCode ? (
                    <Link href={`/tai-khoan/don-hang/${detail.orderId}`}>
                      {orderCode}
                    </Link>
                  ) : detail.orderId ? (
                    'Đơn hàng liên kết'
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>
            </div>

            <div className="nt-card nt-card--pad">
              <h3 style={{ marginTop: 0 }}>Trao đổi</h3>
              {(detail.messages ?? []).length === 0 ? (
                <p className="nt-muted" style={{ margin: 0 }}>
                  Chưa có phản hồi. Nội dung ban đầu của bạn đã được ghi nhận ở
                  trên.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {(detail.messages ?? []).map((message) => {
                    const isStaff = message.authorType === 'STAFF';
                    return (
                      <li
                        key={message.id}
                        style={{
                          border: '1px solid var(--nt-border)',
                          borderRadius: 12,
                          padding: '0.85rem 1rem',
                          background: isStaff ? '#f0f9ff' : '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                            marginBottom: 6,
                          }}
                        >
                          <strong>
                            {isStaff ? 'Nhân viên hỗ trợ' : 'Bạn'}
                          </strong>
                          <span
                            className="nt-muted"
                            style={{ fontSize: '0.82rem' }}
                          >
                            {formatDateTime(message.createdAt)}
                          </span>
                        </div>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {canReply ? (
                <form
                  onSubmit={onReply}
                  style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}
                >
                  <div className="nt-field">
                    <label className="nt-label" htmlFor="support-reply">
                      Phản hồi của bạn
                      <RequiredMark />
                    </label>
                    <textarea
                      id="support-reply"
                      className="nt-textarea"
                      rows={5}
                      value={reply}
                      maxLength={SUPPORT_LIMITS.MESSAGE_MAX}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Nhập nội dung phản hồi…"
                      disabled={replying}
                    />
                    <span className="nt-field-hint">
                      {reply.trim().length}/{SUPPORT_LIMITS.MESSAGE_MAX} ký tự
                    </span>
                  </div>
                  {replyError ? (
                    <p className="nt-form-error" role="alert">
                      {replyError}
                    </p>
                  ) : null}
                  {replySuccess ? (
                    <p className="nt-form-success" role="status">
                      {replySuccess}
                    </p>
                  ) : null}
                  <div>
                    <button
                      type="submit"
                      className={`nt-btn nt-btn-primary${replying ? ' nt-btn--loading' : ''}`}
                      disabled={replying}
                    >
                      {replying ? 'Đang gửi…' : 'Gửi phản hồi'}
                    </button>
                  </div>
                </form>
              ) : (
                <p
                  className="nt-muted"
                  style={{ marginTop: '1rem', marginBottom: 0 }}
                >
                  Phiếu đã kết thúc — không thể gửi thêm tin nhắn.
                </p>
              )}
            </div>
          </div>
        ) : null}
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
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Hỗ trợ</h2>
        {!creating ? (
          <button
            type="button"
            className="nt-btn nt-btn-primary"
            onClick={openCreate}
          >
            Tạo phiếu hỗ trợ
          </button>
        ) : null}
      </div>

      {formSuccess ? (
        <p
          className="nt-form-success"
          role="status"
          style={{ marginTop: '1rem' }}
        >
          {formSuccess}
        </p>
      ) : null}

      {creating ? (
        <form
          onSubmit={onCreate}
          className="nt-card nt-card--pad"
          style={{ marginTop: '1rem', display: 'grid', gap: '0.9rem' }}
          noValidate
        >
          <h3 style={{ margin: 0 }}>Tạo phiếu hỗ trợ mới</h3>

          <div className="nt-field">
            <label className="nt-label" htmlFor="support-category">
              Danh mục
              <RequiredMark />
            </label>
            <select
              id="support-category"
              className="nt-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="nt-field">
            <label className="nt-label" htmlFor="support-subject">
              Tiêu đề
              <RequiredMark />
            </label>
            <input
              id="support-subject"
              className="nt-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={SUPPORT_LIMITS.SUBJECT_MAX}
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={
                fieldErrors.subject
                  ? 'support-subject-error'
                  : 'support-subject-hint'
              }
            />
            {fieldErrors.subject ? (
              <span id="support-subject-error" className="nt-field-error">
                {fieldErrors.subject}
              </span>
            ) : (
              <span id="support-subject-hint" className="nt-field-hint">
                {subject.trim().length}/{SUPPORT_LIMITS.SUBJECT_MAX} ký tự (tối
                thiểu {SUPPORT_LIMITS.SUBJECT_MIN})
              </span>
            )}
          </div>

          <div className="nt-field">
            <label className="nt-label" htmlFor="support-description">
              Nội dung
              <RequiredMark />
            </label>
            <textarea
              id="support-description"
              className="nt-textarea"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={SUPPORT_LIMITS.DESCRIPTION_MAX}
              disabled={saving}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description
                  ? 'support-description-error'
                  : 'support-description-hint'
              }
              placeholder="Mô tả chi tiết vấn đề bạn đang gặp…"
            />
            {fieldErrors.description ? (
              <span id="support-description-error" className="nt-field-error">
                {fieldErrors.description}
              </span>
            ) : (
              <span id="support-description-hint" className="nt-field-hint">
                {description.trim().length}/{SUPPORT_LIMITS.DESCRIPTION_MAX} ký
                tự (tối thiểu {SUPPORT_LIMITS.DESCRIPTION_MIN})
              </span>
            )}
          </div>

          <div className="nt-field">
            <label className="nt-label" htmlFor="support-order">
              Đơn hàng liên quan (tùy chọn)
            </label>
            <select
              id="support-order"
              className="nt-select"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              disabled={saving}
            >
              <option value="">— Không liên kết đơn hàng —</option>
              {orders.map((order) => {
                const label = formatOrderOptionLabel(order);
                return (
                  <option key={order.id} value={order.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span className="nt-field-hint">
              Chọn theo mã đơn, ngày, trạng thái và sản phẩm — không dùng UUID.
            </span>
            {(() => {
              const selectedOrder = orderId
                ? ordersById.get(orderId)
                : undefined;
              const firstItem = selectedOrder?.items?.[0];
              if (!firstItem) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.65rem',
                    alignItems: 'center',
                    marginTop: '0.5rem',
                    border: '1px solid var(--nt-border)',
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
                      item={firstItem}
                      alt={firstItem.productName ?? 'Sản phẩm'}
                    />
                  </div>
                  <span style={{ fontSize: '0.9rem' }}>
                    {summarizeOrderItems(selectedOrder?.items)}
                  </span>
                </div>
              );
            })()}
          </div>

          {formError ? (
            <p className="nt-form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              className={`nt-btn nt-btn-primary${saving ? ' nt-btn--loading' : ''}`}
              disabled={saving}
            >
              {saving ? 'Đang gửi…' : 'Gửi phiếu'}
            </button>
            <button
              type="button"
              className="nt-btn nt-btn-ghost"
              onClick={closeCreate}
              disabled={saving}
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
              onClick={openCreate}
            >
              Tạo phiếu hỗ trợ
            </button>
          }
        />
      ) : items.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: creating ? '1rem' : '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {items.map((ticket) => {
            const code = ticket.ticketCode ?? ticket.id;
            const related = ticket.orderId
              ? ordersById.get(ticket.orderId)
              : undefined;
            const orderLabel = related?.orderCode?.trim() || null;
            const hasUnread = ticket.status === 'WAITING_CUSTOMER';
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => openTicket(ticket)}
                  className="nt-card nt-card--pad"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--nt-border)',
                    display: 'grid',
                    gap: '0.35rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <strong>{code}</strong>
                    <span className="nt-badge nt-badge--info">
                      {statusLabel(ticket.status)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{ticket.subject ?? '—'}</div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem 1rem',
                      color: 'var(--nt-text-muted)',
                      fontSize: '0.88rem',
                    }}
                  >
                    <span>Danh mục: {categoryLabel(ticket.category)}</span>
                    <span>
                      Đơn:{' '}
                      {orderLabel ?? (ticket.orderId ? 'Có liên kết' : '—')}
                    </span>
                    <span>Cập nhật: {formatDateTime(ticket.updatedAt)}</span>
                    {hasUnread ? (
                      <span
                        className="nt-badge nt-badge--warning"
                        style={{ fontWeight: 600 }}
                      >
                        Có phản hồi mới
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="nt-skeleton"
          style={{ minHeight: 160 }}
          role="status"
          aria-busy="true"
        >
          Đang tải hỗ trợ…
        </div>
      }
    >
      <SupportPageInner />
    </Suspense>
  );
}
