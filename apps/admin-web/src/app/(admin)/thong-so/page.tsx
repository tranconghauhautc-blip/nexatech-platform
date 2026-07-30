'use client';

import { useMemo, useState } from 'react';
import { createSpecTemplateRequestSchema } from '@nexatech/shared-contracts';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import type { CategoryTreeNode, SpecTemplate } from '../../../lib/types';
import { flattenCategoryTree } from '../../../lib/catalog-tree';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Drawer } from '../../../components/ui/Drawer';
import { SelectField, TextField } from '../../../components/ui/form';
import { useToast } from '../../../components/ui/toast';

interface AttributeForm {
  key: string;
  label: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit: string;
  isFilterable: boolean;
}

interface GroupForm {
  name: string;
  attributes: AttributeForm[];
}

const EMPTY_ATTRIBUTE: AttributeForm = {
  key: '',
  label: '',
  dataType: 'string',
  unit: '',
  isFilterable: true,
};

export default function SpecTemplatesPage() {
  const { showToast } = useToast();
  const { items: categories } = useArrayQuery<CategoryTreeNode>({
    service: 'catalog',
    path: 'categories',
  });
  const flatCategories = useMemo(
    () => flattenCategoryTree(categories),
    [categories],
  );

  const [categoryId, setCategoryId] = useState('');
  const {
    items: templates,
    loading,
    error,
    refetch,
  } = useArrayQuery<SpecTemplate>({
    service: 'catalog',
    path: 'admin/catalog/spec-templates',
    query: { categoryId },
    enabled: Boolean(categoryId),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [groups, setGroups] = useState<GroupForm[]>([
    { name: 'Thông số chung', attributes: [{ ...EMPTY_ATTRIBUTE }] },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setTemplateName('');
    setGroups([
      { name: 'Thông số chung', attributes: [{ ...EMPTY_ATTRIBUTE }] },
    ]);
    setFormError(null);
    setDrawerOpen(true);
  };

  const updateGroup = (index: number, patch: Partial<GroupForm>) => {
    setGroups((current) =>
      current.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    );
  };

  const updateAttribute = (
    groupIndex: number,
    attrIndex: number,
    patch: Partial<AttributeForm>,
  ) => {
    setGroups((current) =>
      current.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              attributes: g.attributes.map((a, ai) =>
                ai === attrIndex ? { ...a, ...patch } : a,
              ),
            }
          : g,
      ),
    );
  };

  const addGroup = () =>
    setGroups((current) => [
      ...current,
      { name: '', attributes: [{ ...EMPTY_ATTRIBUTE }] },
    ]);
  const removeGroup = (index: number) =>
    setGroups((current) => current.filter((_, i) => i !== index));
  const addAttribute = (groupIndex: number) =>
    setGroups((current) =>
      current.map((g, i) =>
        i === groupIndex
          ? { ...g, attributes: [...g.attributes, { ...EMPTY_ATTRIBUTE }] }
          : g,
      ),
    );
  const removeAttribute = (groupIndex: number, attrIndex: number) =>
    setGroups((current) =>
      current.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              attributes: g.attributes.filter((_, ai) => ai !== attrIndex),
            }
          : g,
      ),
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryId) {
      setFormError('Vui lòng chọn danh mục trước');
      return;
    }
    const payload = {
      categoryId,
      name: templateName.trim(),
      groups: groups.map((g, gi) => ({
        name: g.name.trim(),
        sortOrder: gi,
        attributes: g.attributes.map((a, ai) => ({
          key: a.key.trim(),
          label: a.label.trim(),
          dataType: a.dataType,
          unit: a.unit.trim() || undefined,
          isFilterable: a.isFilterable,
          sortOrder: ai,
        })),
      })),
    };
    const parsed = createSpecTemplateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await bffRequest('catalog', 'admin/catalog/spec-templates', {
        method: 'POST',
        body: parsed.data,
      });
      showToast('Đã tạo bộ thông số', 'success');
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DataTableColumn<SpecTemplate>[] = [
    { key: 'name', header: 'Tên bộ thông số', render: (t) => t.name },
    { key: 'groups', header: 'Số nhóm', render: (t) => t.groups.length },
    {
      key: 'attributes',
      header: 'Số thuộc tính',
      render: (t) => t.groups.reduce((sum, g) => sum + g.attributes.length, 0),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      render: (t) => new Date(t.createdAt).toLocaleDateString('vi-VN'),
    },
  ];

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Bộ thông số kỹ thuật</div>
          <div className="nx-page-subtitle">
            Định nghĩa thuộc tính động theo từng danh mục sản phẩm
          </div>
        </div>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={openCreate}
          disabled={flatCategories.length === 0}
        >
          + Thêm bộ thông số
        </button>
      </div>

      <div className="nx-card">
        <div className="nx-toolbar">
          <SelectField
            label="Danh mục"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={flatCategories.map(({ node, depth }) => ({
              value: node.id,
              label: `${'— '.repeat(depth)}${node.name}`,
            }))}
            placeholder="Chọn danh mục để xem bộ thông số"
          />
        </div>
        {categoryId ? (
          <DataTable
            columns={columns}
            rows={templates}
            getRowKey={(t) => t.id}
            loading={loading}
            error={error}
            onRetry={refetch}
            emptyTitle="Danh mục này chưa có bộ thông số"
            emptyDescription="Tạo bộ thông số để chuẩn hóa thuộc tính sản phẩm."
          />
        ) : (
          <p className="nx-muted">
            Chọn một danh mục để xem các bộ thông số đã tạo.
          </p>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        title="Thêm bộ thông số"
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleSubmit} className="nx-page" style={{ gap: 16 }}>
          <TextField
            label="Tên bộ thông số"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            required
          />

          {groups.map((group, gi) => (
            <div key={gi} className="nx-card" style={{ padding: 14 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  marginBottom: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <TextField
                    label={`Nhóm ${gi + 1}`}
                    value={group.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  />
                </div>
                {groups.length > 1 ? (
                  <button
                    type="button"
                    className="nx-btn nx-btn-danger nx-btn-sm"
                    onClick={() => removeGroup(gi)}
                  >
                    Xóa nhóm
                  </button>
                ) : null}
              </div>

              {group.attributes.map((attr, ai) => (
                <div
                  key={ai}
                  className="nx-form-grid"
                  style={{ marginBottom: 10 }}
                >
                  <TextField
                    label="Key"
                    value={attr.key}
                    onChange={(e) =>
                      updateAttribute(gi, ai, { key: e.target.value })
                    }
                    placeholder="ram_gb"
                  />
                  <TextField
                    label="Nhãn hiển thị"
                    value={attr.label}
                    onChange={(e) =>
                      updateAttribute(gi, ai, { label: e.target.value })
                    }
                    placeholder="Dung lượng RAM"
                  />
                  <SelectField
                    label="Kiểu dữ liệu"
                    value={attr.dataType}
                    onChange={(e) =>
                      updateAttribute(gi, ai, {
                        dataType: e.target.value as AttributeForm['dataType'],
                      })
                    }
                    options={[
                      { value: 'string', label: 'Chuỗi' },
                      { value: 'number', label: 'Số' },
                      { value: 'boolean', label: 'Đúng/Sai' },
                      { value: 'enum', label: 'Danh sách chọn' },
                    ]}
                  />
                  <TextField
                    label="Đơn vị"
                    value={attr.unit}
                    onChange={(e) =>
                      updateAttribute(gi, ai, { unit: e.target.value })
                    }
                    placeholder="GB"
                  />
                  <div
                    style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}
                  >
                    <label className="nx-checkbox-row">
                      <input
                        type="checkbox"
                        checked={attr.isFilterable}
                        onChange={(e) =>
                          updateAttribute(gi, ai, {
                            isFilterable: e.target.checked,
                          })
                        }
                      />
                      Lọc được
                    </label>
                    {group.attributes.length > 1 ? (
                      <button
                        type="button"
                        className="nx-btn nx-btn-ghost nx-btn-sm"
                        onClick={() => removeAttribute(gi, ai)}
                      >
                        Xóa
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="nx-btn nx-btn-secondary nx-btn-sm"
                onClick={() => addAttribute(gi)}
              >
                + Thêm thuộc tính
              </button>
            </div>
          ))}

          <button
            type="button"
            className="nx-btn nx-btn-secondary"
            onClick={addGroup}
          >
            + Thêm nhóm thông số
          </button>

          {formError ? (
            <span className="nx-error-text">{formError}</span>
          ) : null}

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
              {submitting ? 'Đang lưu...' : 'Lưu bộ thông số'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
