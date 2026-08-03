'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { TextField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import { clientFilterRows, shortenId } from '../../../lib/display-helpers';
import {
  resolveOrderApiFilters,
  useHumanListControls,
} from '../../../lib/human-search';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Đã gửi' },
  { value: 'UNDER_REVIEW', label: 'Đang xét' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Hủy' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const TONE: Record<string, BadgeTone> = {
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'info',
  IN_PROGRESS: 'info',
  REJECTED: 'danger',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

type ClaimAction =
  | 'start_review'
  | 'approve'
  | 'reject'
  | 'start_repair'
  | 'complete'
  | 'cancel';

const ACTIONS_BY_STATUS: Record<
  string,
  Array<{ action: ClaimAction; label: string; danger?: boolean }>
> = {
  SUBMITTED: [
    { action: 'start_review', label: 'Bắt đầu xét' },
    { action: 'cancel', label: 'Hủy', danger: true },
  ],
  UNDER_REVIEW: [
    { action: 'approve', label: 'Duyệt' },
    { action: 'reject', label: 'Từ chối', danger: true },
    { action: 'cancel', label: 'Hủy', danger: true },
  ],
  APPROVED: [
    { action: 'start_repair', label: 'Bắt đầu sửa chữa' },
    { action: 'cancel', label: 'Hủy', danger: true },
  ],
  IN_PROGRESS: [
    { action: 'complete', label: 'Hoàn tất' },
    { action: 'cancel', label: 'Hủy', danger: true },
  ],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export default function Page() {
  const { showToast } = useToast();
  const controls = useHumanListControls({
    defaultSort: 'newest',
    resolveApiFilters: resolveOrderApiFilters,
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'warranty',
    path: 'admin/warranty/claims',
    page: controls.page,
    filters: controls.filters,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const displayedItems = useMemo(() => {
    if (!controls.clientSearch) return items;
    return clientFilterRows(items, controls.clientSearch, [
      (r) => String(r['claimCode'] ?? ''),
      (r) => String(r['orderCode'] ?? ''),
      (r) => String(r['productName'] ?? ''),
      (r) => String(r['skuCode'] ?? ''),
      (r) => String(r['reason'] ?? r['issueDescription'] ?? ''),
      (r) => String(r['orderId'] ?? ''),
      (r) => String(r['customerId'] ?? ''),
    ]);
  }, [items, controls.clientSearch]);

  async function openClaim(row: Record<string, unknown>) {
    const id = String(row['id'] ?? '');
    if (!id) return;
    setSelectedId(id);
    setDetail(row);
    setReason('');
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'warranty',
        `admin/warranty/claims/${id}`,
      );
      setDetail(data ?? row);
    } catch (err) {
      setDetailError(
        getErrorMessage(err, 'Không tải được chi tiết yêu cầu bảo hành'),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setReason('');
    setTransitioning(null);
  }

  async function onTransition(action: ClaimAction) {
    if (!selectedId || !detail) return;
    setTransitioning(action);
    try {
      const body: Record<string, unknown> = { action };
      if (reason.trim()) body.reason = reason.trim();
      if (typeof detail['version'] === 'number') {
        body.expectedVersion = detail['version'];
      }
      const data = await bffRequest<Record<string, unknown>>(
        'warranty',
        `admin/warranty/claims/${selectedId}/transition`,
        { method: 'POST', body },
      );
      setDetail(data);
      showToast('Đã cập nhật yêu cầu bảo hành', 'success');
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Chuyển trạng thái thất bại'), 'error');
    } finally {
      setTransitioning(null);
    }
  }

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'claimCode',
        header: 'Mã yêu cầu',
        render: (r) => {
          const code = String(
            r['claimCode'] ?? shortenId(String(r['id'] ?? '')),
          );
          const id = String(r['id'] ?? '');
          return <span title={id || undefined}>{code}</span>;
        },
      },
      {
        key: 'orderCode',
        header: 'Đơn hàng',
        render: (r) => {
          const orderCode = String(r['orderCode'] ?? '—');
          const orderId = String(r['orderId'] ?? '');
          return <span title={orderId || undefined}>{orderCode}</span>;
        },
      },
      {
        key: 'productName',
        header: 'Sản phẩm',
        render: (r) =>
          String(r['productName'] ?? r['skuCode'] ?? '—').slice(0, 40),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => {
          const status = String(r['status'] ?? '');
          return (
            <Badge tone={TONE[status] ?? 'neutral'}>
              {STATUS_LABEL[status] ?? (status || '—')}
            </Badge>
          );
        },
      },
      {
        key: 'reason',
        header: 'Lý do',
        render: (r) =>
          String(r['reason'] ?? r['issueDescription'] ?? '—').slice(0, 50),
      },
    ],
    [],
  );

  const status = String(detail?.['status'] ?? '');
  const actions = ACTIONS_BY_STATUS[status] ?? [];

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Bảo hành</div>
          <div className="nx-page-subtitle">
            Hàng đợi yêu cầu bảo hành / đổi trả
          </div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Mã yêu cầu, mã đơn, sản phẩm…"
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
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={loading || controls.resolving}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có yêu cầu khớp bộ lọc."
        onRowClick={(row) => void openClaim(row)}
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
        title={
          detail
            ? String(
                detail['claimCode'] ?? shortenId(String(detail['id'] ?? '')),
              )
            : 'Chi tiết bảo hành'
        }
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
              onClick={() => selectedId && void openClaim({ id: selectedId })}
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
              <dt className="nx-hint">Mã yêu cầu</dt>
              <dd style={{ margin: 0 }}>
                <strong>
                  {String(detail['claimCode'] ?? detail['id'] ?? '—')}
                </strong>
              </dd>
              <dt className="nx-hint">Đơn hàng</dt>
              <dd style={{ margin: 0 }} title={String(detail['orderId'] ?? '')}>
                {String(detail['orderCode'] ?? detail['orderId'] ?? '—')}
              </dd>
              <dt className="nx-hint">Sản phẩm</dt>
              <dd style={{ margin: 0 }}>
                {String(detail['productName'] ?? detail['skuCode'] ?? '—')}
              </dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Cập nhật</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['updatedAt'] ?? detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Mô tả</div>
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {String(
                  detail['issueDescription'] ??
                    detail['reason'] ??
                    detail['description'] ??
                    '—',
                )}
              </p>
            </div>

            <div>
              <div className="nx-card-title">Chuyển trạng thái</div>
              <div style={{ marginTop: 8, maxWidth: 420 }}>
                <TextField
                  label="Lý do (tuỳ chọn)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {actions.length === 0 ? (
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
                  {actions.map((item) => (
                    <button
                      key={item.action}
                      type="button"
                      className={`nx-btn nx-btn-sm ${
                        item.danger ? 'nx-btn-danger' : 'nx-btn-secondary'
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
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
