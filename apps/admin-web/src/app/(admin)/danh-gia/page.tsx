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
  resolveUuidOrClient,
  useHumanListControls,
} from '../../../lib/human-search';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'PUBLISHED', label: 'Đã đăng' },
  { value: 'HIDDEN', label: 'Ẩn' },
  { value: 'REJECTED', label: 'Từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'most_reported', label: 'Nhiều báo cáo' },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
  REJECTED: 'danger',
};

type ModerateAction = 'publish' | 'hide' | 'reject' | 'restore';

const ACTIONS_BY_STATUS: Record<
  string,
  Array<{ action: ModerateAction; label: string; danger?: boolean }>
> = {
  PENDING: [
    { action: 'publish', label: 'Duyệt đăng' },
    { action: 'hide', label: 'Ẩn' },
    { action: 'reject', label: 'Từ chối', danger: true },
  ],
  PUBLISHED: [
    { action: 'hide', label: 'Ẩn' },
    { action: 'reject', label: 'Từ chối', danger: true },
  ],
  HIDDEN: [
    { action: 'publish', label: 'Đăng lại' },
    { action: 'restore', label: 'Khôi phục' },
    { action: 'reject', label: 'Từ chối', danger: true },
  ],
  REJECTED: [{ action: 'restore', label: 'Khôi phục' }],
};

const DEFAULT_REASON: Record<ModerateAction, string> = {
  publish: 'Duyệt đánh giá',
  hide: 'Ẩn đánh giá',
  reject: 'Từ chối đánh giá',
  restore: 'Khôi phục đánh giá',
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
    resolveApiFilters: async (term) => resolveUuidOrClient(term, 'productId'),
  });
  const { items, meta, loading, error, refetch } = useListQuery<
    Record<string, unknown>
  >({
    service: 'review',
    path: 'admin/reviews',
    page: controls.page,
    filters: controls.filters,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [moderating, setModerating] = useState<string | null>(null);

  const displayedItems = useMemo(() => {
    if (!controls.clientSearch) return items;
    return clientFilterRows(items, controls.clientSearch, [
      (r) => String(r['displayName'] ?? ''),
      (r) => String(r['title'] ?? ''),
      (r) => String(r['content'] ?? ''),
      (r) => String(r['skuCode'] ?? ''),
      (r) => String(r['productId'] ?? ''),
      (r) => String(r['orderId'] ?? ''),
    ]);
  }, [items, controls.clientSearch]);

  async function openReview(row: Record<string, unknown>) {
    const id = String(row['id'] ?? '');
    if (!id) return;
    setSelectedId(id);
    setDetail(row);
    setReason('');
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await bffRequest<Record<string, unknown>>(
        'review',
        `admin/reviews/${id}`,
      );
      setDetail(data ?? row);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết đánh giá'));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setReason('');
    setModerating(null);
  }

  async function moderate(action: ModerateAction) {
    if (!selectedId || !detail) return;
    const trimmed = reason.trim() || DEFAULT_REASON[action];
    setModerating(action);
    try {
      const body: Record<string, unknown> = {
        action,
        reason: trimmed,
      };
      if (typeof detail['version'] === 'number') {
        body.expectedVersion = detail['version'];
      }
      const data = await bffRequest<Record<string, unknown>>(
        'review',
        `admin/reviews/${selectedId}/moderate`,
        { method: 'POST', body },
      );
      setDetail(data);
      showToast('Đã cập nhật đánh giá', 'success');
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Duyệt đánh giá thất bại'), 'error');
    } finally {
      setModerating(null);
    }
  }

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'product',
        header: 'Sản phẩm',
        render: (r) => {
          const sku = String(r['skuCode'] ?? '');
          const productId = String(r['productId'] ?? '');
          const label = sku || shortenId(productId);
          return <span title={productId || undefined}>{label}</span>;
        },
      },
      {
        key: 'displayName',
        header: 'Khách',
        render: (r) => String(r['displayName'] ?? '—'),
      },
      {
        key: 'rating',
        header: 'Sao',
        render: (r) => String(r['rating'] ?? '—'),
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
        key: 'title',
        header: 'Tiêu đề',
        render: (r) => String(r['title'] ?? r['content'] ?? '—').slice(0, 60),
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
          <div className="nx-page-title">Đánh giá</div>
          <div className="nx-page-subtitle">Duyệt / ẩn đánh giá khách</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="SKU, tên khách, tiêu đề…"
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
        emptyDescription="Chưa có đánh giá khớp bộ lọc."
        onRowClick={(row) => void openReview(row)}
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
            ? String(detail['title'] ?? 'Chi tiết đánh giá').slice(0, 48)
            : 'Chi tiết đánh giá'
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
              onClick={() => selectedId && void openReview({ id: selectedId })}
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
              <dt className="nx-hint">Khách</dt>
              <dd style={{ margin: 0 }}>
                {String(detail['displayName'] ?? '—')}
              </dd>
              <dt className="nx-hint">SKU</dt>
              <dd style={{ margin: 0 }}>{String(detail['skuCode'] ?? '—')}</dd>
              <dt className="nx-hint">Sao</dt>
              <dd style={{ margin: 0 }}>{String(detail['rating'] ?? '—')}</dd>
              <dt className="nx-hint">Trạng thái</dt>
              <dd style={{ margin: 0 }}>
                <Badge tone={TONE[status] ?? 'neutral'}>
                  {STATUS_LABEL[status] ?? (status || '—')}
                </Badge>
              </dd>
              <dt className="nx-hint">Tạo lúc</dt>
              <dd style={{ margin: 0 }}>
                {formatDateTime(detail['createdAt'])}
              </dd>
            </dl>

            <div>
              <div className="nx-card-title">Nội dung</div>
              {detail['title'] ? (
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>
                  {String(detail['title'])}
                </p>
              ) : null}
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {String(detail['content'] ?? '—')}
              </p>
            </div>

            <div>
              <div className="nx-card-title">Kiểm duyệt</div>
              <div style={{ marginTop: 8, maxWidth: 420 }}>
                <TextField
                  label="Lý do (tuỳ chọn)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mặc định theo thao tác nếu để trống"
                />
              </div>
              {actions.length === 0 ? (
                <p className="nx-hint" style={{ marginTop: 8 }}>
                  Không còn thao tác kiểm duyệt.
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
                      disabled={Boolean(moderating)}
                      onClick={() => void moderate(item.action)}
                    >
                      {moderating === item.action ? 'Đang xử lý…' : item.label}
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
