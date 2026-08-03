'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  SpecTemplate,
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

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  status: string;
}

const EMPTY_FORM: ProductForm = {
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

function flattenSpecAttributes(templates: SpecTemplate[]) {
  return templates.flatMap((template) =>
    template.groups.flatMap((group) =>
      group.attributes
        .filter((attr) => attr.id)
        .map((attr) => ({
          attributeId: attr.id as string,
          key: attr.key,
          label: attr.label,
          unit: attr.unit,
          dataType: attr.dataType,
          groupName: group.name,
        })),
    ),
  );
}

function buildSpecsPayload(
  specInputs: Record<string, string>,
): Array<{ attributeId: string; value: string }> {
  return Object.entries(specInputs)
    .map(([attributeId, value]) => ({
      attributeId,
      value: value.trim(),
    }))
    .filter((spec) => spec.value.length > 0);
}

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
  const [createForm, setCreateForm] = useState<ProductForm>(EMPTY_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createSpecInputs, setCreateSpecInputs] = useState<
    Record<string, string>
  >({});
  const [createSpecTemplates, setCreateSpecTemplates] = useState<
    SpecTemplate[]
  >([]);
  const [createSpecsLoading, setCreateSpecsLoading] = useState(false);

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<ProductForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSpecInputs, setEditSpecInputs] = useState<Record<string, string>>(
    {},
  );
  const [editSpecTemplates, setEditSpecTemplates] = useState<SpecTemplate[]>(
    [],
  );
  const [editSpecsLoading, setEditSpecsLoading] = useState(false);

  const [skuForm, setSkuForm] = useState<SkuForm>(EMPTY_SKU);
  const [skuErrors, setSkuErrors] = useState<Record<string, string>>({});
  const [skuSaving, setSkuSaving] = useState(false);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [nameSavingId, setNameSavingId] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [priceSavingId, setPriceSavingId] = useState<string | null>(null);

  const loadSpecTemplates = useCallback(async (categoryId: string) => {
    if (!categoryId) {
      return [] as SpecTemplate[];
    }
    const data = await bffRequest<SpecTemplate[]>(
      'catalog',
      'admin/catalog/spec-templates',
      { query: { categoryId } },
    );
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    if (!createForm.categoryId) {
      setCreateSpecTemplates([]);
      setCreateSpecInputs({});
      return;
    }
    let cancelled = false;
    setCreateSpecsLoading(true);
    loadSpecTemplates(createForm.categoryId)
      .then((templates) => {
        if (cancelled) return;
        setCreateSpecTemplates(templates);
        setCreateSpecInputs((prev) => {
          const next: Record<string, string> = {};
          for (const attr of flattenSpecAttributes(templates)) {
            next[attr.attributeId] = prev[attr.attributeId] ?? '';
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setCreateSpecTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setCreateSpecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createForm.categoryId, loadSpecTemplates]);

  useEffect(() => {
    if (!editMode || !editForm.categoryId) {
      if (!editMode) {
        setEditSpecTemplates([]);
      }
      return;
    }
    let cancelled = false;
    setEditSpecsLoading(true);
    loadSpecTemplates(editForm.categoryId)
      .then((templates) => {
        if (cancelled) return;
        setEditSpecTemplates(templates);
        setEditSpecInputs((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const attr of flattenSpecAttributes(templates)) {
            if (next[attr.attributeId] === undefined) {
              next[attr.attributeId] = '';
            }
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setEditSpecTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setEditSpecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editForm.categoryId, editMode, loadSpecTemplates]);

  const createSpecAttributes = useMemo(
    () => flattenSpecAttributes(createSpecTemplates),
    [createSpecTemplates],
  );
  const editSpecAttributes = useMemo(
    () => flattenSpecAttributes(editSpecTemplates),
    [editSpecTemplates],
  );

  function populateEditForm(product: ProductDetail) {
    setEditForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      categoryId: product.categoryId,
      brandId: product.brandId,
      status: product.status,
    });
    const specMap: Record<string, string> = {};
    for (const spec of product.specValues) {
      specMap[spec.attributeId] = spec.value;
    }
    setEditSpecInputs(specMap);
    setEditErrors({});
  }

  async function openDetail(row: ProductSummaryRow) {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setEditMode(false);
    setSkuForm(EMPTY_SKU);
    setSkuErrors({});
    setNameEdits({});
    setPriceEdits({});
    try {
      const data = await bffRequest<ProductDetail>(
        'catalog',
        `products/${row.slug}`,
      );
      setDetail(data);
      populateEditForm(data);
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
      if (editMode) {
        populateEditForm(data);
      }
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
      specs: buildSpecsPayload(createSpecInputs),
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
      setCreateForm(EMPTY_FORM);
      setCreateSpecInputs({});
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Tạo sản phẩm thất bại'), 'error');
    } finally {
      setCreating(false);
    }
  }

  async function saveProductEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const payload = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || undefined,
      categoryId: editForm.categoryId,
      brandId: editForm.brandId,
      status: editForm.status as 'draft' | 'active' | 'inactive' | 'archived',
      specs: buildSpecsPayload(editSpecInputs),
    };
    if (!payload.name) {
      setEditErrors({ name: 'Tên sản phẩm bắt buộc' });
      return;
    }
    if (!payload.categoryId) {
      setEditErrors({ categoryId: 'Chọn danh mục' });
      return;
    }
    if (!payload.brandId) {
      setEditErrors({ brandId: 'Chọn thương hiệu' });
      return;
    }
    setEditErrors({});
    setEditSaving(true);
    try {
      await bffRequest('catalog', `admin/catalog/products/${detail.id}`, {
        method: 'PATCH',
        body: payload,
      });
      showToast('Đã cập nhật sản phẩm', 'success');
      setEditMode(false);
      await refreshDetail();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cập nhật sản phẩm thất bại'), 'error');
    } finally {
      setEditSaving(false);
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

  async function updateSkuName(skuId: string, currentName: string) {
    const name = (nameEdits[skuId] ?? currentName).trim();
    if (!name) {
      showToast('Tên biến thể không được trống', 'error');
      return;
    }
    if (name === currentName.trim()) {
      showToast('Không có thay đổi tên SKU', 'info');
      return;
    }
    setNameSavingId(skuId);
    try {
      await bffRequest('catalog', `admin/catalog/skus/${skuId}`, {
        method: 'PATCH',
        body: { name },
      });
      showToast('Đã cập nhật tên SKU', 'success');
      setNameEdits((edits) => {
        const next = { ...edits };
        delete next[skuId];
        return next;
      });
      await refreshDetail();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Cập nhật tên SKU thất bại'), 'error');
    } finally {
      setNameSavingId(null);
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

  function renderSpecFields(
    attributes: ReturnType<typeof flattenSpecAttributes>,
    specInputs: Record<string, string>,
    setSpecInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    loading: boolean,
  ) {
    if (loading) {
      return <p className="nx-hint">Đang tải mẫu thông số…</p>;
    }
    if (attributes.length === 0) {
      return (
        <p className="nx-hint">
          Danh mục chưa có mẫu thông số — cấu hình tại mục Thông số.
        </p>
      );
    }
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {attributes.map((attr) => (
          <TextField
            key={attr.attributeId}
            label={`${attr.groupName} · ${attr.label}${attr.unit ? ` (${attr.unit})` : ''}`}
            value={specInputs[attr.attributeId] ?? ''}
            onChange={(e) =>
              setSpecInputs((prev) => ({
                ...prev,
                [attr.attributeId]: e.target.value,
              }))
            }
            placeholder={attr.dataType === 'number' ? 'VD: 8' : ''}
          />
        ))}
      </div>
    );
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
            setCreateForm(EMPTY_FORM);
            setCreateErrors({});
            setCreateSpecInputs({});
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
          {createForm.categoryId ? (
            <div>
              <div className="nx-card-title">Thông số kỹ thuật</div>
              {renderSpecFields(
                createSpecAttributes,
                createSpecInputs,
                setCreateSpecInputs,
                createSpecsLoading,
              )}
            </div>
          ) : null}
          <div className="nx-hint">
            Sau khi tạo, bấm vào dòng sản phẩm để thêm SKU/giá và gắn media.
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
          setEditMode(false);
        }}
      >
        {detailLoading ? <p className="nx-hint">Đang tải…</p> : null}
        {detailError ? <p className="nx-error-text">{detailError}</p> : null}
        {detail ? (
          <div className="nx-page" style={{ gap: 20 }}>
            {!editMode ? (
              <>
                <div>
                  <div
                    style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                  >
                    <Badge tone={STATUS_TONE[detail.status] ?? 'neutral'}>
                      {STATUS_LABEL[detail.status] ?? detail.status}
                    </Badge>
                    <span className="nx-hint">/{detail.slug}</span>
                    <button
                      type="button"
                      className="nx-btn nx-btn-ghost"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => {
                        populateEditForm(detail);
                        setEditMode(true);
                      }}
                    >
                      Sửa sản phẩm
                    </button>
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
                  {detail.specValues.length > 0 ? (
                    <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13 }}>
                      {detail.specValues.map((spec) => (
                        <li key={spec.id}>
                          <code>{spec.attributeId.slice(0, 8)}…</code>:{' '}
                          {spec.value}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {STATUS_OPTIONS.filter(
                      (o) => o.value !== detail.status,
                    ).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="nx-btn nx-btn-ghost"
                        onClick={() => changeStatus(o.value)}
                      >
                        → {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <form
                onSubmit={saveProductEdit}
                className="nx-page"
                style={{ gap: 14 }}
              >
                <div className="nx-card-title">Sửa sản phẩm</div>
                <TextField
                  label="Tên sản phẩm"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  error={editErrors.name}
                  required
                />
                <TextField
                  label="Slug"
                  value={editForm.slug}
                  readOnly
                  hint="Slug không đổi qua PATCH — hiển thị tham chiếu."
                />
                <SelectField
                  label="Danh mục"
                  value={editForm.categoryId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                  options={categoryOptions}
                  error={editErrors.categoryId}
                />
                <SelectField
                  label="Thương hiệu"
                  value={editForm.brandId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, brandId: e.target.value }))
                  }
                  options={brandOptions}
                  error={editErrors.brandId}
                />
                <SelectField
                  label="Trạng thái"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                  options={STATUS_OPTIONS}
                />
                <TextareaField
                  label="Mô tả"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={4}
                />
                <div>
                  <div className="nx-card-title">Thông số kỹ thuật</div>
                  {renderSpecFields(
                    editSpecAttributes,
                    editSpecInputs,
                    setEditSpecInputs,
                    editSpecsLoading,
                  )}
                </div>
                <div className="nx-form-actions">
                  <button
                    type="button"
                    className="nx-btn nx-btn-secondary"
                    onClick={() => {
                      setEditMode(false);
                      populateEditForm(detail);
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="nx-btn nx-btn-primary"
                    disabled={editSaving}
                  >
                    {editSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}

            <div>
              <div className="nx-card-title">SKU & giá</div>
              <p className="nx-hint" style={{ margin: '0 0 8px' }}>
                Sửa tên biến thể (PATCH SKU) hoặc cập nhật giá riêng.
              </p>
              {detail.skus.length === 0 ? (
                <p className="nx-hint">Chưa có SKU nào.</p>
              ) : (
                <table className="nx-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Tên biến thể</th>
                      <th>Giá hiện tại</th>
                      <th>Cập nhật giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.skus.map((sku) => {
                      const nameBusy = nameSavingId === sku.id;
                      const priceBusy = priceSavingId === sku.id;
                      const rowBusy = nameBusy || priceBusy;
                      return (
                        <tr key={sku.id}>
                          <td>{sku.skuCode}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                className="nx-input"
                                style={{ minWidth: 160 }}
                                value={nameEdits[sku.id] ?? sku.name}
                                disabled={rowBusy}
                                onChange={(e) =>
                                  setNameEdits((edits) => ({
                                    ...edits,
                                    [sku.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="nx-btn nx-btn-ghost"
                                disabled={rowBusy}
                                onClick={() =>
                                  void updateSkuName(sku.id, sku.name)
                                }
                              >
                                {nameBusy ? 'Đang lưu…' : 'Lưu tên'}
                              </button>
                            </div>
                          </td>
                          <td>
                            {sku.price ? formatVnd(sku.price.amount) : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                className="nx-input"
                                style={{ width: 120 }}
                                type="number"
                                min={0}
                                placeholder="VND"
                                disabled={rowBusy}
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
                                disabled={rowBusy}
                                onClick={() => void updatePrice(sku.id)}
                              >
                                {priceBusy ? 'Đang lưu…' : 'Lưu giá'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
