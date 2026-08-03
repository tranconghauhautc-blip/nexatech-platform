'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Roles, hasMinimumRole } from '@nexatech/shared-auth';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Drawer } from '../../../components/ui/Drawer';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { TextField, SelectField } from '../../../components/ui/form';
import { EmptyState } from '../../../components/ui/states';
import { useToast } from '../../../components/ui/toast';
import { useAdminRoles } from '../../../lib/use-admin-roles';
import {
  STOCK_EMPTY_DESCRIPTION,
  STOCK_EMPTY_TITLE,
  STOCK_MODE_LABELS,
  buildLocationSelectOptions,
  buildStockMutationRequest,
  filterStockByLocationId,
  formatMovementLocation,
  formatMovementReference,
  formatStockUpdatedAt,
  generateIdempotencyKey,
  resolveLocationTypeLabel,
  resolveMovementTypeLabel,
  type LocationOption,
  type LocationType,
  type StockMovementRow,
  type StockMutationMode,
  validateStockForm,
} from './kho-hang-page.helpers';

interface StockFormState {
  mode: StockMutationMode;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity: string;
  onHand: string;
  note: string;
  reason: string;
  reference: string;
}

const EMPTY_FORM: StockFormState = {
  mode: 'receive',
  skuCode: '',
  locationType: 'warehouse',
  locationId: '',
  quantity: '',
  onHand: '',
  note: '',
  reason: '',
  reference: '',
};

export default function Page() {
  const roles = useAdminRoles();
  const canMutate = hasMinimumRole(roles, Roles.Staff);
  const { showToast } = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('sku_asc');
  const [locationFilter, setLocationFilter] = useState('');

  const [warehouses, setWarehouses] = useState<LocationOption[]>([]);
  const [stores, setStores] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<StockFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySku, setHistorySku] = useState('');
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'inventory',
    path: 'stock',
    query: search ? { skuCode: search } : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    setLocationsLoading(true);
    Promise.all([
      bffRequest<LocationOption[]>('inventory', 'warehouses').catch(() => []),
      bffRequest<LocationOption[]>('inventory', 'stores').catch(() => []),
    ])
      .then(([wh, st]) => {
        if (cancelled) return;
        setWarehouses(Array.isArray(wh) ? wh : []);
        setStores(Array.isArray(st) ? st : []);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const locationNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of [...warehouses, ...stores]) {
      if (!row?.id) continue;
      const label = [row.name, row.code].filter(Boolean).join(' · ') || row.id;
      map[row.id] = label;
    }
    return map;
  }, [warehouses, stores]);

  const locationFilterOptions = useMemo(
    () =>
      [...warehouses, ...stores].map((loc) => ({
        value: loc.id,
        label: [loc.code, loc.name].filter(Boolean).join(' · ') || loc.id,
      })),
    [warehouses, stores],
  );

  const drawerLocationOptions = useMemo(
    () =>
      buildLocationSelectOptions(
        form.locationType === 'warehouse' ? warehouses : stores,
      ),
    [form.locationType, warehouses, stores],
  );

  const filteredItems = useMemo(
    () => filterStockByLocationId(items, locationFilter),
    [items, locationFilter],
  );

  const sortedItems = useMemo(() => {
    const rows = [...filteredItems];
    rows.sort((a, b) => {
      const skuA = String(a['skuCode'] ?? a.id ?? '');
      const skuB = String(b['skuCode'] ?? b.id ?? '');
      const availA = Number(a['available'] ?? a['onHand'] ?? 0);
      const availB = Number(b['available'] ?? b['onHand'] ?? 0);
      const updatedA = new Date(String(a['updatedAt'] ?? 0)).getTime();
      const updatedB = new Date(String(b['updatedAt'] ?? 0)).getTime();
      if (sort === 'sku_desc') return skuB.localeCompare(skuA);
      if (sort === 'available_desc') return availB - availA;
      if (sort === 'available_asc') return availA - availB;
      if (sort === 'updated_desc') return updatedB - updatedA;
      if (sort === 'updated_asc') return updatedA - updatedB;
      return skuA.localeCompare(skuB);
    });
    return rows;
  }, [filteredItems, sort]);

  const openDrawer = (prefill?: Partial<StockFormState>) => {
    setForm({ ...EMPTY_FORM, ...prefill });
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const openDrawerFromRow = (row: Record<string, unknown>) => {
    const locationType = String(row['locationType'] ?? 'warehouse');
    openDrawer({
      skuCode: String(row['skuCode'] ?? ''),
      locationType:
        locationType === 'store' ? 'store' : ('warehouse' as LocationType),
      locationId: String(row['locationId'] ?? ''),
      mode: 'receive',
    });
  };

  const loadMovements = async (skuCode: string) => {
    const code = skuCode.trim();
    if (!code) return;
    setHistorySku(code);
    setHistoryOpen(true);
    setMovementsLoading(true);
    setMovementsError(null);
    try {
      const data = await bffRequest<{ items?: StockMovementRow[] }>(
        'inventory',
        'movements',
        { query: { skuCode: code, pageSize: 50 } },
      );
      setMovements(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMovements([]);
      setMovementsError(
        getErrorMessage(err, 'Không tải được lịch sử xuất/nhập'),
      );
    } finally {
      setMovementsLoading(false);
    }
  };

  const openHistoryFromRow = (row: Record<string, unknown>) => {
    void loadMovements(String(row['skuCode'] ?? ''));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMutate) {
      showToast('Bạn không có quyền thao tác tồn kho', 'error');
      return;
    }

    const quantity = form.quantity.trim()
      ? Number.parseInt(form.quantity, 10)
      : undefined;
    const onHand = form.onHand.trim()
      ? Number.parseInt(form.onHand, 10)
      : undefined;

    const parsed = {
      mode: form.mode,
      skuCode: form.skuCode,
      locationType: form.locationType,
      locationId: form.locationId,
      quantity,
      onHand,
      note: form.note,
      reason: form.reason,
      reference: form.reference,
    };

    const errors = validateStockForm(parsed);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      const idempotencyKey = generateIdempotencyKey();
      const { path, body } = buildStockMutationRequest({
        ...parsed,
        idempotencyKey,
      });
      await bffRequest('inventory', path, {
        method: 'POST',
        body,
      });
      showToast(
        form.mode === 'receive'
          ? 'Đã nhập kho'
          : form.mode === 'issue'
            ? 'Đã xuất kho'
            : 'Đã điều chỉnh tồn',
        'success',
      );
      setDrawerOpen(false);
      refetch();
      if (historyOpen && historySku === form.skuCode.trim()) {
        void loadMovements(form.skuCode.trim());
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'skuCode',
        header: 'SKU',
        render: (r) => String(r['skuCode'] ?? r.id ?? ''),
      },
      {
        key: 'onHand',
        header: 'Tồn thực',
        render: (r) => String(r['onHand'] ?? '—'),
      },
      {
        key: 'reserved',
        header: 'Đang giữ',
        render: (r) => String(r['reserved'] ?? '—'),
      },
      {
        key: 'available',
        header: 'Khả dụng',
        render: (r) => String(r['available'] ?? r['onHand'] ?? '—'),
      },
      {
        key: 'locationType',
        header: 'Loại vị trí',
        render: (r) => resolveLocationTypeLabel(r['locationType']),
      },
      {
        key: 'locationId',
        header: 'Vị trí',
        render: (r) => {
          const id = String(
            r['locationId'] ?? r['warehouseId'] ?? r['storeId'] ?? '',
          );
          if (!id) return '—';
          const name = locationNames[id];
          if (!name) {
            return <span title={id}>{id}</span>;
          }
          return (
            <span title={id}>
              {name}
              <br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>{id}</span>
            </span>
          );
        },
      },
      {
        key: 'updatedAt',
        header: 'Cập nhật',
        render: (r) => formatStockUpdatedAt(r['updatedAt']),
      },
      {
        key: 'actions',
        header: '',
        render: (r) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="nx-link-btn"
              onClick={(e) => {
                e.stopPropagation();
                openHistoryFromRow(r);
              }}
            >
              Lịch sử
            </button>
            {canMutate ? (
              <button
                type="button"
                className="nx-link-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openDrawerFromRow(r);
                }}
              >
                Thao tác
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [canMutate, locationNames],
  );

  const showEmptyWithCta =
    !loading && !error && sortedItems.length === 0 && canMutate;

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Tồn kho</div>
          <div className="nx-page-subtitle">
            Theo dõi và quản lý tồn theo SKU/vị trí
          </div>
        </div>
        {canMutate ? (
          <button
            type="button"
            className="nx-btn nx-btn-primary"
            onClick={() => openDrawer()}
          >
            Nhập / điều chỉnh tồn
          </button>
        ) : null}
      </div>

      {!canMutate ? (
        <p style={{ color: '#4b6478', marginBottom: 12 }}>
          Vai trò Staff trở lên mới được nhập, xuất hoặc điều chỉnh tồn.
        </p>
      ) : null}

      <ListToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Mã SKU…"
        searchLabel="SKU"
        statusValue={locationFilter}
        onStatusChange={setLocationFilter}
        statusLabel="Vị trí"
        statusOptions={locationFilterOptions}
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'sku_asc', label: 'SKU A→Z' },
          { value: 'sku_desc', label: 'SKU Z→A' },
          { value: 'available_desc', label: 'Khả dụng giảm' },
          { value: 'available_asc', label: 'Khả dụng tăng' },
          { value: 'updated_desc', label: 'Cập nhật mới nhất' },
          { value: 'updated_asc', label: 'Cập nhật cũ nhất' },
        ]}
        onApply={() => setSearch(searchInput.trim())}
        onReset={() => {
          setSearchInput('');
          setSearch('');
          setSort('sku_asc');
          setLocationFilter('');
        }}
      />

      {showEmptyWithCta ? (
        <EmptyState
          title={STOCK_EMPTY_TITLE}
          description={STOCK_EMPTY_DESCRIPTION}
          action={
            <button
              type="button"
              className="nx-btn nx-btn-primary"
              onClick={() => openDrawer()}
            >
              Nhập / điều chỉnh tồn
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={sortedItems}
          getRowKey={(r) =>
            String(r.id ?? `${String(r['skuCode'])}-${String(r['locationId'])}`)
          }
          loading={loading || locationsLoading}
          error={error}
          onRetry={refetch}
          emptyTitle={STOCK_EMPTY_TITLE}
          emptyDescription={
            search || locationFilter
              ? 'Không có bản ghi khớp bộ lọc.'
              : STOCK_EMPTY_DESCRIPTION
          }
          onRowClick={openHistoryFromRow}
        />
      )}

      <Drawer
        open={historyOpen}
        title={historySku ? `Lịch sử · ${historySku}` : 'Lịch sử xuất/nhập'}
        onClose={() => setHistoryOpen(false)}
      >
        <div style={{ padding: '0 4px 16px', display: 'grid', gap: 12 }}>
          {movementsLoading ? (
            <p className="nx-hint">Đang tải lịch sử…</p>
          ) : movementsError ? (
            <div>
              <p className="nx-error-text">{movementsError}</p>
              <button
                type="button"
                className="nx-btn nx-btn-secondary nx-btn-sm"
                onClick={() => void loadMovements(historySku)}
              >
                Thử lại
              </button>
            </div>
          ) : movements.length === 0 ? (
            <p className="nx-hint">Chưa có biến động tồn cho SKU này.</p>
          ) : (
            <table className="nx-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Vị trí</th>
                  <th>Loại</th>
                  <th>SL</th>
                  <th>Lý do / tham chiếu</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.skuCode}</td>
                    <td>{formatMovementLocation(m, locationNames)}</td>
                    <td>{resolveMovementTypeLabel(m.type)}</td>
                    <td>{m.quantity}</td>
                    <td>{formatMovementReference(m)}</td>
                    <td>{formatStockUpdatedAt(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canMutate && historySku ? (
            <div className="nx-form-actions">
              <button
                type="button"
                className="nx-btn nx-btn-primary nx-btn-sm"
                onClick={() =>
                  openDrawer({ skuCode: historySku, mode: 'receive' })
                }
              >
                Nhập / điều chỉnh
              </button>
            </div>
          ) : null}
        </div>
      </Drawer>

      <Drawer
        open={drawerOpen}
        title="Nhập / điều chỉnh tồn"
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleSubmit} className="nx-page" style={{ gap: 16 }}>
          <SelectField
            label="Thao tác"
            value={form.mode}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                mode: e.target.value as StockMutationMode,
              }))
            }
            options={(
              Object.entries(STOCK_MODE_LABELS) as Array<
                [StockMutationMode, string]
              >
            ).map(([value, label]) => ({ value, label }))}
          />
          <TextField
            label="Mã SKU"
            value={form.skuCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, skuCode: e.target.value }))
            }
            error={fieldErrors.skuCode}
            required
            placeholder="VD: NT-PHONE-NX1-BLK"
          />
          <SelectField
            label="Loại vị trí"
            value={form.locationType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                locationType: e.target.value as LocationType,
                locationId: '',
              }))
            }
            options={[
              { value: 'warehouse', label: 'Kho' },
              { value: 'store', label: 'Cửa hàng' },
            ]}
          />
          <SelectField
            label="Vị trí"
            value={form.locationId}
            onChange={(e) =>
              setForm((f) => ({ ...f, locationId: e.target.value }))
            }
            options={drawerLocationOptions}
            placeholder="— Chọn vị trí —"
            error={fieldErrors.locationId}
            required
          />
          {form.mode === 'adjust' ? (
            <TextField
              label="Tồn mục tiêu (onHand)"
              type="number"
              min={0}
              step={1}
              value={form.onHand}
              onChange={(e) =>
                setForm((f) => ({ ...f, onHand: e.target.value }))
              }
              error={fieldErrors.onHand}
              required
              hint="Đặt số tồn tuyệt đối sau kiểm kê (không thấp hơn lượng đang giữ)"
            />
          ) : (
            <TextField
              label="Số lượng"
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
              error={fieldErrors.quantity}
              required
            />
          )}
          {form.mode === 'adjust' ? (
            <TextField
              label="Lý do kiểm kê"
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({ ...f, reason: e.target.value }))
              }
              error={fieldErrors.reason}
              required
            />
          ) : (
            <TextField
              label="Ghi chú"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              hint="Tuỳ chọn"
            />
          )}
          <TextField
            label="Tham chiếu"
            value={form.reference}
            onChange={(e) =>
              setForm((f) => ({ ...f, reference: e.target.value }))
            }
            hint="Tuỳ chọn — được nối vào ghi chú/lý do"
            placeholder="PO-2026-001, phiếu kiểm kê…"
          />
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
              {submitting ? 'Đang xử lý…' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
