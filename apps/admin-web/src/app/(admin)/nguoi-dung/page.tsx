'use client';

import { useMemo, useState } from 'react';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import { Badge } from '../../../components/ui/Badge';
import { SelectField } from '../../../components/ui/form';

interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
  passwordHash?: string;
  createdAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'PENDING_VERIFICATION', label: 'Chờ xác minh' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

const ROLE_OPTIONS = [
  { value: 'Customer', label: 'Customer' },
  { value: 'Staff', label: 'Staff' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Admin', label: 'Admin' },
  { value: 'SuperAdmin', label: 'Super Admin' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Mới nhất' },
  { value: 'createdAt_asc', label: 'Cũ nhất' },
  { value: 'email_asc', label: 'Email A→Z' },
  { value: 'email_desc', label: 'Email Z→A' },
];

export default function UsersPage() {
  const controls = useListControls({
    defaultSort: 'createdAt_desc',
    searchToFilters: (search) => ({ q: search }),
  });
  const [roleFilter, setRoleFilter] = useState('');
  const filters = useMemo(
    () => ({
      ...controls.filters,
      ...(roleFilter ? { role: roleFilter } : {}),
    }),
    [controls.filters, roleFilter],
  );
  const { items, meta, loading, error, refetch } = useListQuery<AdminUserRow>({
    service: 'identity',
    path: 'admin/users',
    page: controls.page,
    filters,
  });
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [editRole, setEditRole] = useState('Customer');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const columns = useMemo<DataTableColumn<AdminUserRow>[]>(
    () => [
      { key: 'email', header: 'Email', render: (r) => r.email },
      { key: 'fullName', header: 'Họ tên', render: (r) => r.fullName },
      {
        key: 'roles',
        header: 'Vai trò',
        render: (r) => (r.roles ?? []).join(', ') || '—',
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => <Badge>{r.status}</Badge>,
      },
      {
        key: 'leak',
        header: 'Lab leak',
        render: (r) =>
          r.passwordHash ? String(r.passwordHash).slice(0, 16) + '…' : '—',
      },
    ],
    [],
  );

  async function savePatch() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await bffRequest('identity', `admin/users/${selected.id}`, {
        method: 'PATCH',
        body: { roles: [editRole], status: editStatus },
      });
      setSelected(null);
      refetch();
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Người dùng & vai trò</div>
          <div className="nx-page-subtitle">
            Super Admin — identity users (BFLA/mass-assignment luôn mở cho WAF PoC)
          </div>
        </div>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Email hoặc họ tên…"
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
        onApply={controls.apply}
        onReset={() => {
          controls.reset();
          setRoleFilter('');
        }}
        extra={
          <div className="nx-field" style={{ margin: 0, minWidth: 140 }}>
            <label className="nx-label" htmlFor="role-filter">
              Vai trò
            </label>
            <select
              id="role-filter"
              className="nx-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                controls.setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có người dùng"
        emptyDescription="Chưa có user khớp bộ lọc."
        onRowClick={(row) => {
          setSelected(row);
          setEditRole(row.roles?.[0] ?? 'Customer');
          setEditStatus(row.status);
        }}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />
      {selected ? (
        <div className="nx-panel" style={{ marginTop: 16 }}>
          <div className="nx-card-title">Sửa {selected.email}</div>
          <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
            <SelectField
              label="Vai trò"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              options={ROLE_OPTIONS}
            />
            <SelectField
              label="Trạng thái"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>
          {saveError ? (
            <p className="nx-error-text" style={{ marginTop: 8 }}>
              {saveError}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="nx-btn nx-btn-primary"
              disabled={saving}
              onClick={savePatch}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="nx-btn nx-btn-ghost"
              onClick={() => setSelected(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
