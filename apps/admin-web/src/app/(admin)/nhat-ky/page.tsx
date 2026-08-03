'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Drawer } from '../../../components/ui/Drawer';
import { getAuditActionLabel } from '../../../lib/audit-labels';
import {
  clientFilterRows,
  formatAuditResource,
  redactSensitiveFields,
  shortenId,
} from '../../../lib/display-helpers';
import { useIdentityUsersMap } from '../../../lib/use-identity-users-map';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

type AuditRow = Record<string, unknown>;

function pickDetailField(
  details: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!details) return undefined;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export default function Page() {
  const {
    formatActor,
    actorMatchesSearch,
    loading: usersLoading,
  } = useIdentityUsersMap();
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: () => ({}),
  });
  const [clientSearch, setClientSearch] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const { items, meta, loading, error, refetch } = useListQuery<AuditRow>({
    service: 'reporting',
    path: 'admin/reporting/audit-logs',
    page: controls.page,
    filters: controls.filters,
  });

  const filteredItems = useMemo(() => {
    if (!clientSearch.trim()) return items;
    const q = clientSearch.trim().toLowerCase();
    return items.filter((row) => {
      if (actorMatchesSearch(row['actorId'], q)) return true;
      const details = row['details'] as Record<string, unknown> | undefined;
      return (
        clientFilterRows([row], q, [
          (r) => String(r['action'] ?? ''),
          (r) => getAuditActionLabel(String(r['action'] ?? '')),
          (r) => String(r['resourceType'] ?? ''),
          (r) => String(r['resourceId'] ?? ''),
          () =>
            pickDetailField(details, [
              'name',
              'orderCode',
              'orderNumber',
              'skuCode',
            ]),
        ]).length > 0
      );
    });
  }, [items, clientSearch, actorMatchesSearch]);

  const columns = useMemo<DataTableColumn<AuditRow>[]>(
    () => [
      {
        key: 'createdAt',
        header: 'Thời gian',
        render: (r) => {
          const raw = r['occurredAt'] ?? r['createdAt'];
          if (typeof raw !== 'string') return '—';
          try {
            return new Date(raw).toLocaleString('vi-VN');
          } catch {
            return raw;
          }
        },
      },
      {
        key: 'action',
        header: 'Hành động',
        render: (r) => {
          const raw = String(r['action'] ?? '—');
          return <span title={raw}>{getAuditActionLabel(raw)}</span>;
        },
      },
      {
        key: 'actorId',
        header: 'Người thực hiện',
        render: (r) => {
          const id = String(r['actorId'] ?? '');
          const label = formatActor(r['actorId']);
          return (
            <span title={id || undefined}>
              {usersLoading && id ? shortenId(id) : label}
            </span>
          );
        },
      },
      {
        key: 'resourceType',
        header: 'Tài nguyên',
        render: (r) => {
          const details = r['details'] as Record<string, unknown> | undefined;
          const { primary, secondary } = formatAuditResource(
            r['resourceType'],
            r['resourceId'],
            details,
          );
          return <span title={secondary}>{primary}</span>;
        },
      },
    ],
    [formatActor, usersLoading],
  );

  const selectedDetails = selected?.['details'] as
    | Record<string, unknown>
    | undefined;
  const before = selectedDetails?.['before'];
  const after = selectedDetails?.['after'];
  const safeDetails = redactSensitiveFields(selectedDetails);

  function handleApply() {
    setClientSearch(controls.searchInput.trim());
    controls.setPage(1);
  }

  function handleReset() {
    controls.reset();
    setClientSearch('');
    setSelected(null);
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Nhật ký</div>
          <div className="nx-page-subtitle">Audit log hệ thống</div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Hành động hoặc email người thực hiện…"
        searchLabel="Tìm kiếm"
        sortValue={controls.sort}
        onSortChange={(v) => {
          controls.setSort(v);
          controls.setPage(1);
        }}
        sortOptions={SORT_OPTIONS}
        onApply={handleApply}
        onReset={handleReset}
      />
      {clientSearch ? (
        <p className="nx-hint" style={{ marginBottom: 8 }}>
          Đang lọc client-side theo &quot;{clientSearch}&quot; trên trang hiện
          tại.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={filteredItems}
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có audit log khớp bộ lọc."
        onRowClick={setSelected}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: clientSearch ? filteredItems.length : meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
      <Drawer
        open={Boolean(selected)}
        title={
          selected
            ? getAuditActionLabel(String(selected['action'] ?? ''))
            : 'Chi tiết audit'
        }
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div style={{ padding: '0 4px 16px' }}>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: '8px 12px',
                fontSize: 14,
              }}
            >
              <dt className="nx-hint">Mã hành động</dt>
              <dd>
                <code>{String(selected['action'] ?? '—')}</code>
              </dd>
              <dt className="nx-hint">Thời gian</dt>
              <dd>
                {new Date(
                  String(selected['occurredAt'] ?? selected['createdAt'] ?? ''),
                ).toLocaleString('vi-VN')}
              </dd>
              <dt className="nx-hint">Người thực hiện</dt>
              <dd title={String(selected['actorId'] ?? '')}>
                {formatActor(selected['actorId'])}
              </dd>
              <dt className="nx-hint">Vai trò</dt>
              <dd>
                {Array.isArray(selected['actorRoles'])
                  ? (selected['actorRoles'] as string[]).join(', ')
                  : '—'}
              </dd>
              <dt className="nx-hint">Tài nguyên</dt>
              <dd>
                {
                  formatAuditResource(
                    selected['resourceType'],
                    selected['resourceId'],
                    selectedDetails,
                  ).primary
                }
              </dd>
              <dt className="nx-hint">Service</dt>
              <dd>{String(selected['serviceName'] ?? '—')}</dd>
              <dt className="nx-hint">Trace / Request</dt>
              <dd>
                {pickDetailField(selectedDetails, [
                  'traceId',
                  'requestId',
                  'correlationId',
                ]) ?? '—'}
              </dd>
              <dt className="nx-hint">Source event</dt>
              <dd>{String(selected['sourceEventId'] ?? '—')}</dd>
            </dl>
            {before !== undefined ? (
              <>
                <div className="nx-card-title" style={{ marginTop: 16 }}>
                  Trước
                </div>
                <pre
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(redactSensitiveFields(before), null, 2)}
                </pre>
              </>
            ) : null}
            {after !== undefined ? (
              <>
                <div className="nx-card-title" style={{ marginTop: 16 }}>
                  Sau
                </div>
                <pre
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(redactSensitiveFields(after), null, 2)}
                </pre>
              </>
            ) : null}
            {selectedDetails ? (
              <>
                <div className="nx-card-title" style={{ marginTop: 16 }}>
                  Metadata
                </div>
                <pre
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(safeDetails, null, 2)}
                </pre>
              </>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
