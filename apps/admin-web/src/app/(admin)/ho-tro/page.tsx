'use client';

import { SUPPORT_LIMITS } from '@nexatech/shared-contracts';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { TextareaField, SelectField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import { clientFilterRows, shortenId } from '../../../lib/display-helpers';
import {
  resolveOrderApiFilters,
  useHumanListControls,
} from '../../../lib/human-search';
import { useIdentityUsersMap } from '../../../lib/use-identity-users-map';

type TicketRow = Record<string, unknown>;

interface TicketMessage {
  id: string;
  authorId: string;
  authorType: 'CUSTOMER' | 'STAFF';
  content: string;
  createdAt: string;
}

interface TicketDetail extends TicketRow {
  id: string;
  ticketCode?: string;
  subject?: string;
  description?: string;
  status?: string;
  category?: string;
  priority?: string;
  orderId?: string;
  assigneeId?: string;
  version?: number;
  messages?: TicketMessage[];
  updatedAt?: string;
  createdAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Mở' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_CUSTOMER', label: 'Chờ khách' },
  { value: 'WAITING_STAFF', label: 'Chờ nhân viên' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đóng' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const CATEGORY_LABEL: Record<string, string> = {
  ORDER: 'Đơn hàng',
  PRODUCT: 'Sản phẩm',
  PAYMENT: 'Thanh toán',
  SHIPPING: 'Vận chuyển',
  WARRANTY: 'Bảo hành',
  ACCOUNT: 'Tài khoản',
  OTHER: 'Khác',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  WAITING_CUSTOMER: 'warning',
  WAITING_STAFF: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
};

const TRANSITION_ACTIONS: Record<
  string,
  Array<{ action: string; label: string }>
> = {
  OPEN: [
    { action: 'start', label: 'Bắt đầu xử lý' },
    { action: 'cancel', label: 'Hủy phiếu' },
  ],
  IN_PROGRESS: [
    { action: 'wait_customer', label: 'Chờ khách phản hồi' },
    { action: 'resolve', label: 'Đánh dấu đã xong' },
    { action: 'close', label: 'Đóng phiếu' },
    { action: 'cancel', label: 'Hủy phiếu' },
  ],
  WAITING_CUSTOMER: [{ action: 'cancel', label: 'Hủy phiếu' }],
  WAITING_STAFF: [
    { action: 'start', label: 'Tiếp tục xử lý' },
    { action: 'resolve', label: 'Đánh dấu đã xong' },
    { action: 'close', label: 'Đóng phiếu' },
    { action: 'cancel', label: 'Hủy phiếu' },
  ],
  RESOLVED: [
    { action: 'close', label: 'Đóng phiếu' },
    { action: 'reopen', label: 'Mở lại' },
  ],
  CLOSED: [],
  CANCELLED: [],
};

const CLOSED_STATUSES = new Set(['CLOSED', 'CANCELLED']);

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

export default function Page() {
  const { showToast } = useToast();
  const { usersById, formatActor } = useIdentityUsersMap();
  const controls = useHumanListControls({
    defaultSort: 'newest',
    resolveApiFilters: resolveOrderApiFilters,
  });
  const { items, meta, loading, error, refetch } = useListQuery<TicketRow>({
    service: 'support',
    path: 'admin/support/tickets',
    page: controls.page,
    filters: controls.filters,
  });

  const [orderCodeById, setOrderCodeById] = useState<Record<string, string>>(
    {},
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [staffOptions, setStaffOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const displayedItems = useMemo(() => {
    if (!controls.clientSearch) return items;
    return clientFilterRows(items, controls.clientSearch, [
      (r) => String(r['ticketCode'] ?? r['code'] ?? ''),
      (r) => String(r['subject'] ?? ''),
      (r) => String(r['description'] ?? ''),
      (r) => String(r['category'] ?? ''),
      (r) => String(r['orderId'] ?? ''),
      (r) => orderCodeById[String(r['orderId'] ?? '')] ?? '',
      (r) => String(r['customerId'] ?? ''),
    ]);
  }, [items, controls.clientSearch, orderCodeById]);

  useEffect(() => {
    const ids = [
      ...new Set(
        items.map((row) => String(row['orderId'] ?? '').trim()).filter(Boolean),
      ),
    ].filter((id) => !(id in orderCodeById));
    if (ids.length === 0) return;

    let cancelled = false;
    void Promise.all(
      ids.map(async (orderId) => {
        try {
          const order = await bffRequest<{
            orderCode?: string;
            code?: string;
          }>('order', `admin/orders/${orderId}`);
          return {
            orderId,
            code: String(order.orderCode ?? order.code ?? '').trim(),
          };
        } catch {
          return { orderId, code: '' };
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setOrderCodeById((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.orderId] = row.code;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items, orderCodeById]);

  useEffect(() => {
    let cancelled = false;
    bffRequest<{
      items?: Array<{
        id: string;
        email?: string;
        fullName?: string;
        roles?: string[];
      }>;
    }>('identity', 'admin/users', {
      query: { page: 1, pageSize: 200 },
    })
      .then((response) => {
        if (cancelled) return;
        const staffRoles = new Set(['Staff', 'Manager', 'Admin', 'SuperAdmin']);
        const options = (response.items ?? [])
          .filter((user) =>
            (user.roles ?? []).some((role) => staffRoles.has(role)),
          )
          .map((user) => ({
            value: user.id,
            label: user.fullName?.trim()
              ? `${user.fullName} (${user.email ?? user.id})`
              : (user.email ?? user.id),
          }));
        setStaffOptions(options);
      })
      .catch(() => {
        if (!cancelled) setStaffOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await bffRequest<TicketDetail>(
        'support',
        `admin/support/tickets/${ticketId}`,
      );
      setDetail(data);
      setAssigneeId(String(data.assigneeId ?? ''));
      const orderId = String(data.orderId ?? '').trim();
      if (orderId) {
        try {
          const order = await bffRequest<{
            orderCode?: string;
            code?: string;
          }>('order', `admin/orders/${orderId}`);
          const code = String(order.orderCode ?? order.code ?? '').trim();
          if (code) {
            setOrderCodeById((prev) => ({ ...prev, [orderId]: code }));
          }
        } catch {
          // keep shortened id fallback
        }
      }
    } catch (err) {
      setDetail(null);
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết ticket'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function openTicket(row: TicketRow) {
    const id = String(row['id'] ?? '');
    if (!id) return;
    setSelectedId(id);
    setReply('');
    await loadDetail(id);
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setReply('');
    setTransitioning(null);
  }

  async function onReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !detail) return;
    const content = reply.trim();
    if (content.length < SUPPORT_LIMITS.MESSAGE_MIN) {
      showToast('Vui lòng nhập nội dung phản hồi', 'error');
      return;
    }
    if (content.length > SUPPORT_LIMITS.MESSAGE_MAX) {
      showToast(`Tin nhắn tối đa ${SUPPORT_LIMITS.MESSAGE_MAX} ký tự`, 'error');
      return;
    }
    setReplying(true);
    try {
      await bffRequest(
        'support',
        `admin/support/tickets/${selectedId}/messages`,
        {
          method: 'POST',
          body: {
            content,
            idempotencyKey: crypto.randomUUID(),
          },
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setReply('');
      showToast('Đã gửi phản hồi', 'success');
      await loadDetail(selectedId);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gửi phản hồi thất bại'), 'error');
    } finally {
      setReplying(false);
    }
  }

  async function onTransition(action: string) {
    if (!selectedId || !detail) return;
    setTransitioning(action);
    try {
      await bffRequest(
        'support',
        `admin/support/tickets/${selectedId}/transition`,
        {
          method: 'POST',
          body: {
            action,
            expectedVersion: detail.version,
            idempotencyKey: crypto.randomUUID(),
          },
          idempotencyKey: crypto.randomUUID(),
        },
      );
      showToast('Đã cập nhật trạng thái', 'success');
      await loadDetail(selectedId);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Chuyển trạng thái thất bại'), 'error');
    } finally {
      setTransitioning(null);
    }
  }

  async function onAssign() {
    if (!selectedId || !detail || !assigneeId) {
      showToast('Chọn nhân viên để gán', 'error');
      return;
    }
    setAssigning(true);
    try {
      await bffRequest(
        'support',
        `admin/support/tickets/${selectedId}/assign`,
        {
          method: 'POST',
          body: {
            assigneeId,
            expectedVersion: detail.version,
            idempotencyKey: crypto.randomUUID(),
          },
          idempotencyKey: crypto.randomUUID(),
        },
      );
      showToast('Đã gán ticket', 'success');
      await loadDetail(selectedId);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gán ticket thất bại'), 'error');
    } finally {
      setAssigning(false);
    }
  }

  const columns = useMemo<DataTableColumn<TicketRow>[]>(
    () => [
      {
        key: 'ticketCode',
        header: 'Mã ticket',
        render: (r) => {
          const code = String(
            r['ticketCode'] ?? r['code'] ?? shortenId(String(r['id'] ?? '')),
          );
          const id = String(r['id'] ?? '');
          return <span title={id || undefined}>{code}</span>;
        },
      },
      {
        key: 'subject',
        header: 'Tiêu đề',
        render: (r) => String(r['subject'] ?? '—').slice(0, 50),
      },
      {
        key: 'priority',
        header: 'Ưu tiên',
        render: (r) => {
          const priority = String(r['priority'] ?? '');
          return PRIORITY_LABEL[priority] ?? (priority || '—');
        },
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
        key: 'orderId',
        header: 'Đơn liên quan',
        render: (r) => {
          const orderId = String(r['orderId'] ?? '');
          if (!orderId) return '—';
          const code = orderCodeById[orderId];
          return (
            <span title={orderId}>
              {code && code.length > 0 ? code : shortenId(orderId)}
            </span>
          );
        },
      },
      {
        key: 'updatedAt',
        header: 'Cập nhật',
        render: (r) => formatDateTime(r['updatedAt']),
      },
    ],
    [orderCodeById],
  );

  const status = String(detail?.status ?? '');
  const transitions = TRANSITION_ACTIONS[status] ?? [];
  const canReply = detail ? !CLOSED_STATUSES.has(status) : false;
  const detailOrderId = String(detail?.orderId ?? '').trim();
  const detailOrderCode = detailOrderId
    ? orderCodeById[detailOrderId]
    : undefined;
  const drawerTitle = detail
    ? String(detail.ticketCode ?? detail.id ?? 'Chi tiết ticket')
    : 'Chi tiết ticket';

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Hỗ trợ</div>
          <div className="nx-page-subtitle">Ticket hỗ trợ khách hàng</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã ticket, tiêu đề, mã đơn…"
        searchLabel="Tìm kiếm"
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
        onApply={() => void controls.applySearch()}
        onReset={() => {
          controls.resetAll();
          closeDrawer();
        }}
      />
      {controls.clientSearch ? (
        <p className="nx-hint" style={{ marginBottom: 8 }}>
          Lọc thêm theo &quot;{controls.clientSearch}&quot; trên trang hiện tại.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={displayedItems}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading || controls.resolving}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có ticket khớp bộ lọc."
        onRowClick={(row) => void openTicket(row)}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: controls.clientSearch
            ? displayedItems.length
            : meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />

      <Drawer
        open={Boolean(selectedId)}
        title={drawerTitle}
        onClose={closeDrawer}
      >
        {detailLoading ? (
          <p className="nx-hint">Đang tải chi tiết…</p>
        ) : detailError ? (
          <div style={{ padding: '0 4px 16px' }}>
            <p className="nx-error-text">{detailError}</p>
            <button
              type="button"
              className="nx-btn nx-btn-secondary nx-btn-sm"
              onClick={() => selectedId && void loadDetail(selectedId)}
            >
              Thử lại
            </button>
          </div>
        ) : detail ? (
          <div style={{ padding: '0 4px 16px', display: 'grid', gap: 16 }}>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: '8px 12px',
                fontSize: 14,
                margin: 0,
              }}
            >
              <dt className="nx-hint">Mã ticket</dt>
              <dd style={{ margin: 0 }}>
                <strong>{String(detail.ticketCode ?? detail.id)}</strong>
              </dd>
              <dt className="nx-hint">Tiêu đề</dt>
              <dd style={{ margin: 0 }}>{String(detail.subject ?? '—')}</dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Danh mục</dt>
              <dd style={{ margin: 0 }}>
                {CATEGORY_LABEL[String(detail.category ?? '')] ??
                  String(detail.category ?? '—')}
              </dd>
              <dt className="nx-hint">Ưu tiên</dt>
              <dd style={{ margin: 0 }}>
                {PRIORITY_LABEL[String(detail.priority ?? '')] ??
                  String(detail.priority ?? '—')}
              </dd>
              <dt className="nx-hint">Đơn hàng</dt>
              <dd style={{ margin: 0 }} title={detailOrderId || undefined}>
                {detailOrderCode && detailOrderCode.length > 0
                  ? detailOrderCode
                  : detailOrderId
                    ? shortenId(detailOrderId)
                    : '—'}
              </dd>
              <dt className="nx-hint">Khách hàng</dt>
              <dd style={{ margin: 0 }} title={String(detail.customerId ?? '')}>
                {formatActor(detail.customerId) !== '—'
                  ? formatActor(detail.customerId)
                  : shortenId(String(detail.customerId ?? ''))}
              </dd>
              <dt className="nx-hint">Người phụ trách</dt>
              <dd style={{ margin: 0 }}>
                {detail.assigneeId
                  ? formatActor(detail.assigneeId)
                  : 'Chưa gán'}
              </dd>
              <dt className="nx-hint">Cập nhật</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(detail.updatedAt)}</dd>
            </dl>

            <div>
              <div className="nx-card-title">Mô tả ban đầu</div>
              <p
                style={{
                  margin: '8px 0 0',
                  whiteSpace: 'pre-wrap',
                  fontSize: 14,
                }}
              >
                {String(detail.description ?? '—')}
              </p>
            </div>

            <div>
              <div className="nx-card-title">Chuyển trạng thái</div>
              {transitions.length === 0 ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  Không còn thao tác chuyển trạng thái.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {transitions.map((item) => (
                    <button
                      key={item.action}
                      type="button"
                      className={`nx-btn nx-btn-sm ${
                        item.action === 'cancel'
                          ? 'nx-btn-danger'
                          : 'nx-btn-secondary'
                      }`}
                      disabled={Boolean(transitioning)}
                      onClick={() => void onTransition(item.action)}
                    >
                      {transitioning === item.action
                        ? 'Đang xử lý…'
                        : item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="nx-card-title">Gán nhân viên</div>
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  marginTop: 8,
                  maxWidth: 420,
                }}
              >
                <SelectField
                  label="Nhân viên"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  options={[
                    { value: '', label: '— Chọn nhân viên —' },
                    ...staffOptions,
                  ]}
                />
                <button
                  type="button"
                  className="nx-btn nx-btn-secondary nx-btn-sm"
                  disabled={assigning || !assigneeId}
                  onClick={() => void onAssign()}
                >
                  {assigning ? 'Đang gán…' : 'Gán ticket'}
                </button>
              </div>
            </div>

            <div>
              <div className="nx-card-title">Hội thoại</div>
              {(detail.messages ?? []).length === 0 ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  Chưa có tin nhắn trao đổi.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '8px 0 0',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  {(detail.messages ?? []).map((message) => {
                    const isStaff = message.authorType === 'STAFF';
                    const authorLabel = isStaff
                      ? usersById.get(message.authorId)?.fullName ||
                        usersById.get(message.authorId)?.email ||
                        'Nhân viên'
                      : 'Khách hàng';
                    return (
                      <li
                        key={message.id}
                        style={{
                          border: '1px solid var(--nx-border)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: isStaff
                            ? 'var(--nx-surface-muted, #f8fafc)'
                            : '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 6,
                            fontSize: 13,
                          }}
                        >
                          <strong>{authorLabel}</strong>
                          <span className="nx-hint">
                            {formatDateTime(message.createdAt)}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontSize: 14,
                          }}
                        >
                          {message.content}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {canReply ? (
              <form onSubmit={onReply} style={{ display: 'grid', gap: 8 }}>
                <TextareaField
                  label="Phản hồi"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={5}
                  maxLength={SUPPORT_LIMITS.MESSAGE_MAX}
                  hint={`${reply.trim().length}/${SUPPORT_LIMITS.MESSAGE_MAX} ký tự`}
                  disabled={replying}
                />
                <button
                  type="submit"
                  className="nx-btn nx-btn-primary"
                  disabled={replying}
                >
                  {replying ? 'Đang gửi…' : 'Gửi phản hồi'}
                </button>
              </form>
            ) : (
              <p className="nx-hint">Ticket đã kết thúc — không thể trả lời.</p>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
