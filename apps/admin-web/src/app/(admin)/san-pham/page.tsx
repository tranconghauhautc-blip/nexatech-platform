'use client';

import { useMemo, useState } from 'react';
import {
  createProductRequestSchema,
  createSkuRequestSchema,
  toSlug,
} from '@nexatech/shared-contracts';
import { formatVnd } from '@nexatech/shared-web';
import { useListQuery } from '../../../lib/use-list-query';
import { useListControls } from '../../../lib/use-list-controls';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import { flattenCategoryTree } from '../../../lib/catalog-tree';
import type {
  Brand,
  CategoryTreeNode,
  ProductDetail,
  ProductSummaryRow,
} from '../../../lib/types';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { Pagination } from '../../../components/ui/Pagination';
import {
  SelectField,
  TextField,
  TextareaField,
} from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';

const STATUS_LABEL: Record<ProductSummaryRow['status'], string> = {
  draft: 'Nháp',
  active: 'Đang bán',
  inactive: 'Ngừng bán',
  archived: 'Lưu trữ',
};

const STATUS_TONE: Record<ProductSummaryRow['status'], BadgeTone> = {
  draft: 'warning',
  active: 'success',
  inactive: 'neutral',
  archived: 'danger',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Nháp' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
  { value: 'archived', label: 'Lưu trữ' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'name', label: 'Tên A→Z' },
  { value: 'price_asc', label: 'Giá tăng' },
  { value: 'price_desc', label: 'Giá giảm' },
  { value: 'relevance', label: 'Liên quan' },
];

interface CreateForm {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  status: string;
}

const EMPTY_CREATE: CreateForm = {
  name: '',
  slug: '',
  description: '',
  categoryId: '',
  brandId: '',
  status: 'draft',
};

interface SkuForm {
  skuCode: string;
  name: string;
  price: string;
}

const EMPTY_SKU: SkuForm = { skuCode: '', name: '', price: '0' };

export default function Page() {
  const { showToast } = useToast();
  const controls = useListControls({
    defaultSort: 'newest',
    searchToFilters: (search) => ({ q: search }),
  });
  const { items, meta, loading, error, refetch } =
    useListQuery<ProductSummaryRow>({
      service: 'catalog',
      path: 'products',
      page: controls.page,
      filters: controls.filters,
    });

  const { items: categoryTree } = useArrayQuery<CategoryTreeNode>({
    service: 'catalog',
    path: 'categories',
  });
  const { items: brands } = useArrayQuery<Brand>({
    service: 'catalog',
    path: 'brands',
  });
  const flatCategories = useMemo(
    () => flattenCategoryTree(categoryTree),
    [categoryTree],
  );
  const categoryOptions = useMemo(
    () =>
      flatCategories.map(({ node, depth }) => ({
        value: node.id,
        label: `${'— '.repeat(depth)}${node.name}`,
      })),
    [flatCategories],
  );
  const brandOptions = useMemo(
    () => brands.map((b) => ({ value: b.id, label: b.name })),
    [brands],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [skuForm, setSkuForm] = useState<SkuForm>(EMPTY_SKU);
  const [skuErrors, setSkuErrors] = useState<Record<string, string>>({});
  const [skuSaving, setSkuSaving] = useState(false);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);

  async function openDetail(row: ProductSummaryRow) {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setSkuForm(EMPTY_SKU);
    setSkuErrors({});
    setPriceEdits({});
    try {
      const data = await bffRequest<ProductDetail>(
        'catalog',
        `products/${row.slug}`,
      );
      setDetail(data);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không tải được chi tiết sản phẩm'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!detail) return;
    try {
      const data = await bffRequest<ProductDetail>(
        'catalog',
        `products/${detail.slug}`,
      );
      setDetail(data);
    } catch {
      // giữ dữ liệu cũ nếu refresh lỗi
    }
  }

  async function createProduct(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      name: createForm.name.trim(),
      slug: createForm.slug.trim() || toSlug(createForm.name),
      description: createForm.description.trim() || undefined,
      categoryId: createForm.categoryId,
      brandId: createForm.brandId,
      status: createForm.status as 'draft' | 'active' | 'inactive' | 'archived',
      specs: [],
    };
    const parsed = createProductRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setCreateErrors(errors);
      return;
    }
    setCreateErrors({});
    setCreating(true);
    try {
      await bffRequest('catalog', 'admin/catalog/products', {
        method: 'POST',
        body: parsed.data,
      });
      showToast('Đã tạo sản phẩm', 'success');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Tạo sản phẩm thất bại'), 'error');
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(status: string) {
    if (!detail) return;
    try {
      await bffRequest(
        'catalog',
        `admin/catalog/products/${detail.id}/status`,
        {
          method: 'PATCH',
          body: { status },
        },
      );
      showToast('Đã đổi trạng thái sản phẩm', 'success');
      await refreshDetail();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Đổi trạng thái thất bại'), 'error');
    }
  }

  async function createSku(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const payload = {
      productId: detail.id,
      skuCode: skuForm.skuCode.trim().toUpperCase(),
      name: skuForm.name.trim() || detail.name,
      attributes: {},
      price: Number(skuForm.price) || 0,
    };
    const parsed = createSkuRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setSkuErrors(errors);
      return;
    }
    setSkuErrors({});
    setSkuSaving(true);
    try {
      await bffRequest('catalog', 'admin/catalog/skus', {
        method: 'POST',
        body: parsed.data,
      });
      showToast('Đã tạo SKU', 'success');
      setSkuForm(EMPTY_SKU);
      await refreshDetail();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Tạo SKU thất bại'), 'error');
    } finally {
      setSkuSaving(false);
    }
  }

  async function updatePrice(skuId: string) {
    const raw = priceEdits[skuId];
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount < 0) {
      showToast('Giá không hợp lệ', 'error');
      return;
    }
    setPriceSavingId(skuId);
    try {
      await bffRequest('catalog', `admin/catalog/skus/${skuId}/prices`, {
        method: 'POST',
        body: { amount, currency: 'VND' },
      });
      showToast('Đã cập nhật giá', 'success');
      await refreshDetail();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cập nhật giá thất bại'), 'error');
    } finally {
      setPriceSavingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<ProductSummaryRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Tên',
        render: (r) => r.name,
      },
      {
        key: 'brandName',
        header: 'Thương hiệu',
        render: (r) => r.brandName || '—',
      },
      {
        key: 'categorySlug',
        header: 'Danh mục',
        render: (r) => r.categorySlug || '—',
      },
      {
        key: 'minPrice',
        header: 'Giá từ',
        render: (r) => formatVnd(r.minPrice),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => (
          <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Sản phẩm</div>
          <div className="nx-page-subtitle">Quản lý catalog sản phẩm</div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={() => {
            setCreateForm(EMPTY_CREATE);
            setCreateErrors({});
            setCreateOpen(true);
          }}
        >
          + Tạo sản phẩm
        </button>
      </div>
      <ListToolbar
        searchValue={controls.searchInput}
        onSearchChange={controls.setSearchInput}
        searchPlaceholder="Tên sản phẩm…"
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
        onReset={controls.reset}
      />
      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Không có dữ liệu"
        emptyDescription="Chưa có sản phẩm khớp bộ lọc."
        onRowClick={openDetail}
      />
      <Pagination
        meta={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.totalItems,
        }}
        onPageChange={controls.setPage}
      />

      <Drawer
        open={createOpen}
        title="Tạo sản phẩm"
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={createProduct} className="nx-page" style={{ gap: 16 }}>
          <TextField
            label="Tên sản phẩm"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((f) => ({
                ...f,
                name: e.target.value,
                slug: f.slug || toSlug(e.target.value),
              }))
            }
            error={createErrors.name}
            required
          />
          <TextField
            label="Slug"
            value={createForm.slug}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, slug: e.target.value }))
            }
            error={createErrors.slug}
            hint="Dạng kebab-case, ví dụ: iphone-15-pro-max"
            required
          />
          <SelectField
            label="Danh mục"
            value={createForm.categoryId}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, categoryId: e.target.value }))
            }
            options={categoryOptions}
            placeholder="— Chọn danh mục —"
            error={createErrors.categoryId}
          />
          <SelectField
            label="Thương hiệu"
            value={createForm.brandId}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, brandId: e.target.value }))
            }
            options={brandOptions}
            placeholder="— Chọn thương hiệu —"
            error={createErrors.brandId}
          />
          <SelectField
            label="Trạng thái"
            value={createForm.status}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, status: e.target.value }))
            }
            options={STATUS_OPTIONS}
          />
          <TextareaField
            label="Mô tả"
            value={createForm.description}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={4}
          />
          <div className="nx-hint">
            Tạo sản phẩm trước, sau đó thêm SKU/giá và gắn media trong màn chi
            tiết (bấm vào dòng sản phẩm sau khi tạo).
          </div>
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
              {creating ? 'Đang tạo…' : 'Tạo sản phẩm'}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={detailLoading || detail !== null || detailError !== null}
        title={detail ? detail.name : 'Chi tiết sản phẩm'}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
      >
        {detailLoading ? <p className="nx-hint">Đang tải…</p> : null}
        {detailError ? <p className="nx-error-text">{detailError}</p> : null}
        {detail ? (
          <div className="nx-page" style={{ gap: 20 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge tone={STATUS_TONE[detail.status] ?? 'neutral'}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </Badge>
                <span className="nx-hint">/{detail.slug}</span>
              </div>
              <p style={{ marginTop: 8, fontSize: 13.5 }}>
                {detail.description || 'Chưa có mô tả.'}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span className="nx-hint">
                  Danh mục: {detail.category?.name ?? '—'} · Thương hiệu:{' '}
                  {detail.brand?.name ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {STATUS_OPTIONS.filter((o) => o.value !== detail.status).map(
                  (o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="nx-btn nx-btn-ghost"
                      onClick={() => changeStatus(o.value)}
                    >
                      → {o.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <div className="nx-card-title">SKU & giá</div>
              {detail.skus.length === 0 ? (
                <p className="nx-hint">Chưa có SKU nào.</p>
              ) : (
                <table className="nx-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Giá hiện tại</th>
                      <th>Cập nhật giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.skus.map((sku) => (
                      <tr key={sku.id}>
                        <td>{sku.skuCode}</td>
                        <td>{sku.price ? formatVnd(sku.price.amount) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="nx-input"
                              style={{ width: 120 }}
                              type="number"
                              min={0}
                              placeholder="VND"
                              value={priceEdits[sku.id] ?? ''}
                              onChange={(e) =>
                                setPriceEdits((edits) => ({
                                  ...edits,
                                  [sku.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="nx-btn nx-btn-ghost"
                              disabled={priceSavingId === sku.id}
                              onClick={() => updatePrice(sku.id)}
                            >
                              Lưu
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <form
                onSubmit={createSku}
                style={{
                  display: 'grid',
                  gap: 10,
                  marginTop: 16,
                  padding: 12,
                  border: '1px dashed var(--nx-border)',
                  borderRadius: 8,
                }}
              >
                <div className="nx-card-title" style={{ fontSize: 13 }}>
                  Thêm SKU mới
                </div>
                <TextField
                  label="Mã SKU"
                  value={skuForm.skuCode}
                  onChange={(e) =>
                    setSkuForm((f) => ({ ...f, skuCode: e.target.value }))
                  }
                  error={skuErrors.skuCode}
                  placeholder="VD: IP15PM-256-TITAN"
                  required
                />
                <TextField
                  label="Tên biến thể"
                  value={skuForm.name}
                  onChange={(e) =>
                    setSkuForm((f) => ({ ...f, name: e.target.value }))
                  }
                  error={skuErrors.name}
                  placeholder={detail.name}
                />
                <TextField
                  label="Giá (VND)"
                  type="number"
                  min={0}
                  value={skuForm.price}
                  onChange={(e) =>
                    setSkuForm((f) => ({ ...f, price: e.target.value }))
                  }
                  error={skuErrors.price}
                />
                <div className="nx-form-actions">
                  <button
                    type="submit"
                    className="nx-btn nx-btn-primary"
                    disabled={skuSaving}
                  >
                    {skuSaving ? 'Đang lưu…' : 'Thêm SKU'}
                  </button>
                </div>
              </form>
            </div>

            <div>
              <div className="nx-card-title">Media đã gắn</div>
              {detail.mediaLinks.length === 0 ? (
                <p className="nx-hint">
                  Chưa có media — sang trang <a href="/media">Media</a> để
                  upload và gắn cho sản phẩm này.
                </p>
              ) : (
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {detail.mediaLinks.map((m) => (
                    <li key={m.id}>
                      {m.role} {m.isPrimary ? '(chính)' : ''} —{' '}
                      <code>{m.mediaId}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
