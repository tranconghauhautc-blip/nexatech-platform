'use client';

import { useMemo, useState } from 'react';
import {
  createCategoryRequestSchema,
  toSlug,
} from '@nexatech/shared-contracts';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import type { CategoryTreeNode } from '../../../lib/types';
import { excludeSubtree, flattenCategoryTree } from '../../../lib/catalog-tree';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { TextField, SelectField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';

interface FormState {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  parentId: '',
  sortOrder: '0',
  isActive: true,
};

export default function CategoriesPage() {
  const { items, loading, error, refetch } = useArrayQuery<CategoryTreeNode>({
    service: 'catalog',
    path: 'categories',
  });
  const { showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const flat = useMemo(() => flattenCategoryTree(items), [items]);
  const parentOptions = useMemo(
    () =>
      excludeSubtree(flat, editingId).map(({ node, depth }) => ({
        value: node.id,
        label: `${'— '.repeat(depth)}${node.name}`,
      })),
    [flat, editingId],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (node: CategoryTreeNode) => {
    setEditingId(node.id);
    setForm({
      name: node.name,
      slug: node.slug,
      parentId: node.parentId ?? '',
      sortOrder: String(node.sortOrder),
      isActive: node.isActive,
    });
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || toSlug(form.name),
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    const parsed = createCategoryRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (editingId) {
        await bffRequest('catalog', `admin/catalog/categories/${editingId}`, {
          method: 'PATCH',
          body: parsed.data,
        });
        showToast('Đã cập nhật danh mục', 'success');
      } else {
        await bffRequest('catalog', 'admin/catalog/categories', {
          method: 'POST',
          body: parsed.data,
        });
        showToast('Đã tạo danh mục mới', 'success');
      }
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (node: CategoryTreeNode) => {
    try {
      await bffRequest('catalog', `admin/catalog/categories/${node.id}`, {
        method: 'PATCH',
        body: { isActive: !node.isActive },
      });
      showToast(
        node.isActive ? 'Đã ẩn danh mục' : 'Đã kích hoạt danh mục',
        'success',
      );
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const columns: DataTableColumn<{ node: CategoryTreeNode; depth: number }>[] =
    [
      {
        key: 'name',
        header: 'Tên danh mục',
        render: ({ node, depth }) => (
          <span style={{ paddingLeft: depth * 18 }}>
            {depth > 0 ? '— ' : ''}
            {node.name}
          </span>
        ),
      },
      { key: 'slug', header: 'Slug', render: ({ node }) => node.slug },
      {
        key: 'sortOrder',
        header: 'Thứ tự',
        render: ({ node }) => node.sortOrder,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: ({ node }) => (
          <Badge tone={node.isActive ? 'success' : 'neutral'}>
            {node.isActive ? 'Hoạt động' : 'Đã ẩn'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: ({ node }) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="nx-link-btn"
              onClick={() => openEdit(node)}
            >
              Sửa
            </button>
            <button
              type="button"
              className="nx-link-btn"
              onClick={() => toggleActive(node)}
            >
              {node.isActive ? 'Ẩn' : 'Kích hoạt'}
            </button>
          </div>
        ),
      },
    ];

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Danh mục sản phẩm</div>
          <div className="nx-page-subtitle">
            Quản lý cây danh mục điện thoại, laptop, tablet, đồng hồ, tai
            nghe/loa, phụ kiện
          </div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={openCreate}
        >
          + Thêm danh mục
        </button>
      </div>

      <div className="nx-card">
        <DataTable
          columns={columns}
          rows={flat}
          getRowKey={(row) => row.node.id}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="Chưa có danh mục nào"
          emptyDescription="Tạo danh mục đầu tiên để bắt đầu tổ chức sản phẩm."
        />
      </div>

      <Drawer
        open={drawerOpen}
        title={editingId ? 'Cập nhật danh mục' : 'Thêm danh mục'}
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleSubmit} className="nx-page" style={{ gap: 16 }}>
          <TextField
            label="Tên danh mục"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: f.slug || toSlug(e.target.value),
              }))
            }
            error={fieldErrors.name}
            required
          />
          <TextField
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            error={fieldErrors.slug}
            hint="Dạng kebab-case, ví dụ: dien-thoai"
            required
          />
          <SelectField
            label="Danh mục cha"
            value={form.parentId}
            onChange={(e) =>
              setForm((f) => ({ ...f, parentId: e.target.value }))
            }
            options={parentOptions}
            placeholder="— Không có (danh mục gốc) —"
          />
          <TextField
            label="Thứ tự hiển thị"
            type="number"
            value={form.sortOrder}
            onChange={(e) =>
              setForm((f) => ({ ...f, sortOrder: e.target.value }))
            }
            error={fieldErrors.sortOrder}
          />
          <label className="nx-checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Kích hoạt danh mục
          </label>
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
