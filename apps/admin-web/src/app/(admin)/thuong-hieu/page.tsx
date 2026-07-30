'use client';

import { useState } from 'react';
import { createBrandRequestSchema, toSlug } from '@nexatech/shared-contracts';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import type { Brand } from '../../../lib/types';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { TextField, TextareaField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';

interface FormState {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  description: '',
  isActive: true,
};

export default function BrandsPage() {
  const { items, loading, error, refetch } = useArrayQuery<Brand>({
    service: 'catalog',
    path: 'brands',
  });
  const { showToast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? '',
      isActive: brand.isActive,
    });
    setFieldErrors({});
    setDrawerOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || toSlug(form.name),
      description: form.description.trim() || undefined,
      isActive: form.isActive,
    };
    const parsed = createBrandRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (editingId) {
        await bffRequest('catalog', `admin/catalog/brands/${editingId}`, {
          method: 'PATCH',
          body: parsed.data,
        });
        showToast('Đã cập nhật thương hiệu', 'success');
      } else {
        await bffRequest('catalog', 'admin/catalog/brands', {
          method: 'POST',
          body: parsed.data,
        });
        showToast('Đã tạo thương hiệu mới', 'success');
      }
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (brand: Brand) => {
    try {
      await bffRequest('catalog', `admin/catalog/brands/${brand.id}`, {
        method: 'PATCH',
        body: { isActive: !brand.isActive },
      });
      showToast(
        brand.isActive ? 'Đã ẩn thương hiệu' : 'Đã kích hoạt thương hiệu',
        'success',
      );
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const columns: DataTableColumn<Brand>[] = [
    { key: 'name', header: 'Thương hiệu', render: (b) => b.name },
    { key: 'slug', header: 'Slug', render: (b) => b.slug },
    {
      key: 'description',
      header: 'Mô tả',
      render: (b) => b.description ?? '—',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (b) => (
        <Badge tone={b.isActive ? 'success' : 'neutral'}>
          {b.isActive ? 'Hoạt động' : 'Đã ẩn'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="nx-link-btn"
            onClick={() => openEdit(b)}
          >
            Sửa
          </button>
          <button
            type="button"
            className="nx-link-btn"
            onClick={() => toggleActive(b)}
          >
            {b.isActive ? 'Ẩn' : 'Kích hoạt'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Thương hiệu</div>
          <div className="nx-page-subtitle">
            Quản lý danh sách thương hiệu sản phẩm
          </div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={openCreate}
        >
          + Thêm thương hiệu
        </button>
      </div>

      <div className="nx-card">
        <DataTable
          columns={columns}
          rows={items}
          getRowKey={(b) => b.id}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="Chưa có thương hiệu nào"
          emptyDescription="Thêm thương hiệu đầu tiên để gắn cho sản phẩm."
        />
      </div>

      <Drawer
        open={drawerOpen}
        title={editingId ? 'Cập nhật thương hiệu' : 'Thêm thương hiệu'}
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleSubmit} className="nx-page" style={{ gap: 16 }}>
          <TextField
            label="Tên thương hiệu"
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
            required
          />
          <TextareaField
            label="Mô tả"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            error={fieldErrors.description}
            rows={4}
          />
          <label className="nx-checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Kích hoạt thương hiệu
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
