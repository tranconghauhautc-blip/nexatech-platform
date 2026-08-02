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
import { Drawer } from '../../../components/ui/Drawer';
import { SelectField, TextField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';
import Link from 'next/link';

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

interface CreateForm {
  email: string;
  fullName: string;
  password: string;
  role: string;
  status: string;
}

const EMPTY_CREATE: CreateForm = {
  email: '',
  fullName: '',
  password: '',
  role: 'Staff',
  status: 'ACTIVE',
};

export default function UsersPage() {
  const { showToast } = useToast();
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
  const [showLabLeak, setShowLabLeak] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);

  // SC-10 / SC-31 (OWASP API3 — excessive data exposure & mass assignment):
  // `GET /admin/users` vẫn trả `passwordHash` nguyên trạng từ backend — đây
  // là PoC luôn mở, KHÔNG được patch API. Cột này vốn hiển thị hash ngay
  // trên bảng vận hành hàng ngày; đã dời khỏi danh sách chính để tránh lộ
  // dữ liệu nhạy cảm ngoài ý muốn cho người dùng vận hành thông thường.
  // Dữ liệu leak vẫn truy cập được có chủ đích qua panel "Sửa" (nút "Hiện
  // dữ liệu leak (lab)") và qua Security Guide (/security-lab) — xem
  // docs/OWASP-SCENARIOS.md (SC-10, SC-31) để biết kịch bản khai thác đầy đủ.
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
        key: 'actions',
        header: '',
        render: (r) => (
          <button
            type="button"
            className="nx-link-btn"
            disabled={r.status === 'DISABLED'}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await bffRequest('identity', `admin/users/${r.id}/disable`, {
                  method: 'POST',
                });
                showToast('Đã vô hiệu hóa người dùng', 'success');
                refetch();
              } catch (err) {
                showToast(getErrorMessage(err), 'error');
              }
            }}
          >
            Vô hiệu hóa
          </button>
        ),
      },
    ],
    [refetch, showToast],
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

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await bffRequest('identity', 'admin/users', {
        method: 'POST',
        body: {
          email: createForm.email.trim(),
          fullName: createForm.fullName.trim(),
          password: createForm.password,
          roles: [createForm.role],
          status: createForm.status,
        },
      });
      showToast('Đã tạo người dùng', 'success');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Người dùng & vai trò</div>
          <div className="nx-page-subtitle">
            Super Admin — tạo / sửa / vô hiệu hóa (BFLA luôn mở cho WAF PoC)
          </div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={() => {
            setCreateForm(EMPTY_CREATE);
            setCreateOpen(true);
          }}
        >
          + Tạo người dùng
        </button>
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
          setShowLabLeak(false);
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

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px dashed var(--nx-border)',
            }}
          >
            <button
              type="button"
              className="nx-link-btn"
              onClick={() => setShowLabLeak((v) => !v)}
            >
              {showLabLeak ? 'Ẩn' : 'Hiện'} dữ liệu leak (lab, SC-31)
            </button>
            {showLabLeak ? (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <p className="nx-hint" style={{ margin: '0 0 4px' }}>
                  passwordHash trả nguyên trạng từ API (không patch — PoC luôn
                  mở). Chi tiết kịch bản:{' '}
                  <Link href="/security-lab">/security-lab</Link>.
                </p>
                <code
                  style={{
                    display: 'block',
                    wordBreak: 'break-all',
                    background: 'var(--nx-surface-2)',
                    padding: '6px 8px',
                    borderRadius: 6,
                  }}
                >
                  {selected.passwordHash ?? '(không có trong response)'}
                </code>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <Drawer
        open={createOpen}
        title="Tạo người dùng"
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={createUser} className="nx-page" style={{ gap: 16 }}>
          <TextField
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, email: e.target.value }))
            }
            required
          />
          <TextField
            label="Họ tên"
            value={createForm.fullName}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, fullName: e.target.value }))
            }
            required
          />
          <TextField
            label="Mật khẩu"
            type="password"
            value={createForm.password}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, password: e.target.value }))
            }
            required
          />
          <SelectField
            label="Vai trò"
            value={createForm.role}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, role: e.target.value }))
            }
            options={ROLE_OPTIONS}
          />
          <SelectField
            label="Trạng thái"
            value={createForm.status}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, status: e.target.value }))
            }
            options={STATUS_OPTIONS}
          />
          <div className="nx-form-actions">
            <button
              type="button"
              className="nx-btn nx-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="nx-btn nx-btn-primary"
              disabled={creating}
            >
              {creating ? 'Đang tạo…' : 'Tạo'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
