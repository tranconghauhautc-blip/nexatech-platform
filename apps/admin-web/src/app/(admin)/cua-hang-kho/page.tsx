'use client';

import { useMemo, useState } from 'react';
import { Roles, hasMinimumRole } from '@nexatech/shared-auth';
import {
  createStoreRequestSchema,
  createWarehouseRequestSchema,
} from '@nexatech/shared-contracts';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { TextField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';
import { useAdminRoles } from '../../../lib/use-admin-roles';

type Tab = 'stores' | 'warehouses';

interface LocationRow {
  id: string;
  code?: string;
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  openingHours?: string;
  pickupEnabled?: boolean;
  isActive?: boolean;
}

interface StoreForm {
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  openingHours: string;
  pickupEnabled: boolean;
  isActive: boolean;
}

interface WarehouseForm {
  code: string;
  name: string;
  address: string;
  isActive: boolean;
}

const EMPTY_STORE: StoreForm = {
  code: '',
  name: '',
  address: '',
  city: '',
  phone: '',
  openingHours: '',
  pickupEnabled: true,
  isActive: true,
};

const EMPTY_WH: WarehouseForm = {
  code: '',
  name: '',
  address: '',
  isActive: true,
};

export default function Page() {
  const roles = useAdminRoles();
  const canMutate = hasMinimumRole(roles, Roles.Manager);
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('stores');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name_asc');

  const storesQuery = useArrayQuery<LocationRow>({
    service: 'inventory',
    path: 'stores',
  });
  const warehousesQuery = useArrayQuery<LocationRow>({
    service: 'inventory',
    path: 'warehouses',
  });

  const activeQuery = tab === 'stores' ? storesQuery : warehousesQuery;
  const { items, loading, error, refetch } = activeQuery;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState<StoreForm>(EMPTY_STORE);
  const [whForm, setWhForm] = useState<WarehouseForm>(EMPTY_WH);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = !search
      ? [...items]
      : items.filter((row) =>
          [row.name, row.code, row.id, row.city, row.address, row.phone]
            .map((v) => String(v ?? '').toLowerCase())
            .some((v) => v.includes(q)),
        );
    rows.sort((a, b) => {
      const nameA = String(a.name ?? '');
      const nameB = String(b.name ?? '');
      const codeA = String(a.code ?? a.id ?? '');
      const codeB = String(b.code ?? b.id ?? '');
      if (sort === 'name_desc') return nameB.localeCompare(nameA);
      if (sort === 'code_asc') return codeA.localeCompare(codeB);
      if (sort === 'code_desc') return codeB.localeCompare(codeA);
      return nameA.localeCompare(nameB);
    });
    return rows;
  }, [items, search, sort]);

  const openCreate = () => {
    setEditingId(null);
    setFieldErrors({});
    if (tab === 'stores') setStoreForm(EMPTY_STORE);
    else setWhForm(EMPTY_WH);
    setDrawerOpen(true);
  };

  const openEditStore = (row: LocationRow) => {
    setEditingId(row.id);
    setStoreForm({
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      address: String(row.address ?? ''),
      city: String(row.city ?? ''),
      phone: String(row.phone ?? ''),
      openingHours: String(row.openingHours ?? ''),
      pickupEnabled: row.pickupEnabled !== false,
      isActive: row.isActive !== false,
    });
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const openEditWarehouse = (row: LocationRow) => {
    setEditingId(row.id);
    setWhForm({
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      address: String(row.address ?? ''),
      isActive: row.isActive !== false,
    });
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canMutate) {
      showToast('Bạn không có quyền tạo/sửa kho hoặc cửa hàng', 'error');
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      if (tab === 'stores') {
        if (editingId) {
          await bffRequest('inventory', `admin/inventory/stores/${editingId}`, {
            method: 'PATCH',
            body: {
              name: storeForm.name.trim(),
              address: storeForm.address.trim() || null,
              city: storeForm.city.trim() || null,
              phone: storeForm.phone.trim() || null,
              openingHours: storeForm.openingHours.trim() || null,
              pickupEnabled: storeForm.pickupEnabled,
              isActive: storeForm.isActive,
            },
          });
          showToast('Đã cập nhật cửa hàng', 'success');
        } else {
          const payload = {
            code: storeForm.code.trim().toUpperCase(),
            name: storeForm.name.trim(),
            address: storeForm.address.trim() || undefined,
            city: storeForm.city.trim() || undefined,
            phone: storeForm.phone.trim() || undefined,
            openingHours: storeForm.openingHours.trim() || undefined,
            pickupEnabled: storeForm.pickupEnabled,
            isActive: storeForm.isActive,
          };
          const parsed = createStoreRequestSchema.safeParse(payload);
          if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
              errors[String(issue.path[0])] = issue.message;
            }
            setFieldErrors(errors);
            return;
          }
          await bffRequest('inventory', 'admin/inventory/stores', {
            method: 'POST',
            body: parsed.data,
          });
          showToast('Đã tạo cửa hàng', 'success');
        }
      } else if (editingId) {
        await bffRequest(
          'inventory',
          `admin/inventory/warehouses/${editingId}`,
          {
            method: 'PATCH',
            body: {
              name: whForm.name.trim(),
              address: whForm.address.trim() || null,
              isActive: whForm.isActive,
            },
          },
        );
        showToast('Đã cập nhật kho', 'success');
      } else {
        const payload = {
          code: whForm.code.trim().toUpperCase(),
          name: whForm.name.trim(),
          address: whForm.address.trim() || undefined,
          isActive: whForm.isActive,
        };
        const parsed = createWarehouseRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const errors: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            errors[String(issue.path[0])] = issue.message;
          }
          setFieldErrors(errors);
          return;
        }
        await bffRequest('inventory', 'admin/inventory/warehouses', {
          method: 'POST',
          body: parsed.data,
        });
        showToast('Đã tạo kho', 'success');
      }
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const storeColumns = useMemo<DataTableColumn<LocationRow>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã',
        render: (r) => String(r.code ?? '—'),
      },
      {
        key: 'name',
        header: 'Tên cửa hàng',
        render: (r) => String(r.name ?? '—'),
      },
      {
        key: 'address',
        header: 'Địa chỉ',
        render: (r) => [r.address, r.city].filter(Boolean).join(', ') || '—',
      },
      {
        key: 'phone',
        header: 'Điện thoại',
        render: (r) => String(r.phone ?? '—'),
      },
      {
        key: 'pickup',
        header: 'Nhận tại CH',
        render: (r) => (
          <Badge tone={r.pickupEnabled ? 'success' : 'neutral'}>
            {r.pickupEnabled ? 'Bật' : 'Tắt'}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <Badge tone={r.isActive !== false ? 'success' : 'neutral'}>
            {r.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
      ...(canMutate
        ? [
            {
              key: 'actions',
              header: '',
              render: (r: LocationRow) => (
                <button
                  type="button"
                  className="nx-link-btn"
                  onClick={() => openEditStore(r)}
                >
                  Sửa
                </button>
              ),
            } satisfies DataTableColumn<LocationRow>,
          ]
        : []),
    ],
    [canMutate],
  );

  const warehouseColumns = useMemo<DataTableColumn<LocationRow>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã',
        render: (r) => String(r.code ?? '—'),
      },
      {
        key: 'name',
        header: 'Tên kho',
        render: (r) => String(r.name ?? '—'),
      },
      {
        key: 'address',
        header: 'Địa chỉ',
        render: (r) => String(r.address ?? '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <Badge tone={r.isActive !== false ? 'success' : 'neutral'}>
            {r.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
      ...(canMutate
        ? [
            {
              key: 'actions',
              header: '',
              render: (r: LocationRow) => (
                <button
                  type="button"
                  className="nx-link-btn"
                  onClick={() => openEditWarehouse(r)}
                >
                  Sửa
                </button>
              ),
            } satisfies DataTableColumn<LocationRow>,
          ]
        : []),
    ],
    [canMutate],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Cửa hàng & kho</div>
          <div className="nx-page-subtitle">
            Quản lý cửa hàng nhận hàng (pickup) và kho tồn
          </div>
        </div>
        {canMutate ? (
          <button
            type="button"
            className="nx-btn nx-btn-primary"
            onClick={openCreate}
          >
            {tab === 'stores' ? '+ Thêm cửa hàng' : '+ Thêm kho'}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={
            tab === 'stores'
              ? 'nx-btn nx-btn-primary'
              : 'nx-btn nx-btn-secondary'
          }
          onClick={() => setTab('stores')}
        >
          Cửa hàng
        </button>
        <button
          type="button"
          className={
            tab === 'warehouses'
              ? 'nx-btn nx-btn-primary'
              : 'nx-btn nx-btn-secondary'
          }
          onClick={() => setTab('warehouses')}
        >
          Kho
        </button>
      </div>

      {!canMutate ? (
        <p style={{ color: '#4b6478', marginBottom: 12 }}>
          Vai trò Staff chỉ xem danh sách. Manager / Admin / Super Admin mới
          được tạo hoặc sửa.
        </p>
      ) : null}

      <ListToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Tên hoặc mã…"
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'name_asc', label: 'Tên A→Z' },
          { value: 'name_desc', label: 'Tên Z→A' },
          { value: 'code_asc', label: 'Mã A→Z' },
          { value: 'code_desc', label: 'Mã Z→A' },
        ]}
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
          setSort('name_asc');
        }}
      />
      <DataTable
        columns={tab === 'stores' ? storeColumns : warehouseColumns}
        rows={filtered}
        getRowKey={(r) => String(r.id ?? r.code ?? Math.random())}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription={
          tab === 'stores'
            ? 'Chưa có cửa hàng. Tạo cửa hàng pickup để checkout nhận tại cửa hàng.'
            : 'Chưa có kho khớp bộ lọc.'
        }
      />

      <Drawer
        open={drawerOpen}
        title={
          tab === 'stores'
            ? editingId
              ? 'Cập nhật cửa hàng'
              : 'Thêm cửa hàng'
            : editingId
              ? 'Cập nhật kho'
              : 'Thêm kho'
        }
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleSubmit} className="nx-page" style={{ gap: 16 }}>
          {tab === 'stores' ? (
            <>
              <TextField
                label="Mã cửa hàng"
                value={storeForm.code}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, code: e.target.value }))
                }
                error={fieldErrors.code}
                required
                disabled={Boolean(editingId)}
                hint="Ví dụ: HCM-NGUYEN-HUE"
              />
              <TextField
                label="Tên cửa hàng"
                value={storeForm.name}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, name: e.target.value }))
                }
                error={fieldErrors.name}
                required
              />
              <TextField
                label="Địa chỉ"
                value={storeForm.address}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, address: e.target.value }))
                }
              />
              <TextField
                label="Thành phố"
                value={storeForm.city}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, city: e.target.value }))
                }
              />
              <TextField
                label="Điện thoại"
                value={storeForm.phone}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
              <TextField
                label="Giờ mở cửa"
                value={storeForm.openingHours}
                onChange={(e) =>
                  setStoreForm((f) => ({ ...f, openingHours: e.target.value }))
                }
                hint="Ví dụ: T2–CN 9:00–21:00"
              />
              <label className="nx-checkbox-row">
                <input
                  type="checkbox"
                  checked={storeForm.pickupEnabled}
                  onChange={(e) =>
                    setStoreForm((f) => ({
                      ...f,
                      pickupEnabled: e.target.checked,
                    }))
                  }
                />
                Cho phép nhận tại cửa hàng (pickup)
              </label>
              <label className="nx-checkbox-row">
                <input
                  type="checkbox"
                  checked={storeForm.isActive}
                  onChange={(e) =>
                    setStoreForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Đang hoạt động
              </label>
            </>
          ) : (
            <>
              <TextField
                label="Mã kho"
                value={whForm.code}
                onChange={(e) =>
                  setWhForm((f) => ({ ...f, code: e.target.value }))
                }
                error={fieldErrors.code}
                required
                disabled={Boolean(editingId)}
              />
              <TextField
                label="Tên kho"
                value={whForm.name}
                onChange={(e) =>
                  setWhForm((f) => ({ ...f, name: e.target.value }))
                }
                error={fieldErrors.name}
                required
              />
              <TextField
                label="Địa chỉ"
                value={whForm.address}
                onChange={(e) =>
                  setWhForm((f) => ({ ...f, address: e.target.value }))
                }
              />
              <label className="nx-checkbox-row">
                <input
                  type="checkbox"
                  checked={whForm.isActive}
                  onChange={(e) =>
                    setWhForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Đang hoạt động
              </label>
            </>
          )}
          <div className="nx-form-actions">
            <button
              type="button"
              className="nx-btn nx-btn-secondary"
              onClick={() => setDrawerOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="nx-btn nx-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
