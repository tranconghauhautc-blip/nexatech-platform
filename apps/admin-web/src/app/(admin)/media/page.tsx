'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { useToast } from '../../../components/ui/toast';

interface ProductOption {
  id: string;
  name: string;
  slug?: string;
}

interface PresignResult {
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  bucket: string;
}

function browserUploadUrl(uploadUrl: string): string {
  try {
    const url = new URL(uploadUrl);
    if (url.hostname === 'minio') {
      url.hostname = 'localhost';
      url.port = url.port || '9000';
    }
    return url.toString();
  } catch {
    return uploadUrl.replace('http://minio:9000', 'http://localhost:9000');
  }
}

export default function Page() {
  const { showToast } = useToast();
  const [entityType, setEntityType] = useState('product');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sort, setSort] = useState('id_asc');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const enabled = entityId.length > 0;

  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'media',
    path: `media/by-entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId || '_')}`,
    enabled,
  });

  useEffect(() => {
    let cancelled = false;
    bffRequest<{ items?: ProductOption[] } | ProductOption[]>(
      'catalog',
      'products',
      {
        query: {
          page: 1,
          pageSize: 50,
          ...(productQuery ? { q: productQuery } : {}),
        },
      },
    )
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: ProductOption[] }).items ?? []);
        setProducts(list);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productQuery]);

  const sortedItems = useMemo(() => {
    const rows = [...items];
    rows.sort((a, b) => {
      const idA = String(a['id'] ?? '');
      const idB = String(b['id'] ?? '');
      const kindA = String(a['kind'] ?? a['mimeType'] ?? '');
      const kindB = String(b['kind'] ?? b['mimeType'] ?? '');
      if (sort === 'id_desc') return idB.localeCompare(idA);
      if (sort === 'kind_asc') return kindA.localeCompare(kindB);
      if (sort === 'kind_desc') return kindB.localeCompare(kindA);
      return idA.localeCompare(idB);
    });
    return rows;
  }, [items, sort]);

  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Media ID',
        render: (r) => String(r['id'] ?? '—'),
      },
      {
        key: 'kind',
        header: 'Loại',
        render: (r) => String(r['kind'] ?? r['mimeType'] ?? '—'),
      },
      {
        key: 'url',
        header: 'URL',
        render: (r) => String(r['url'] ?? r['objectKey'] ?? '—').slice(0, 60),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => String(r['status'] ?? '—'),
      },
    ],
    [],
  );

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    if (!entityId || entityType !== 'product') {
      setUploadError('Chọn sản phẩm (product) trước khi upload.');
      return;
    }
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem(
      'file',
    ) as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setUploadError('Chọn file ảnh.');
      return;
    }
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ] as const;
    if (!allowed.includes(file.type as (typeof allowed)[number])) {
      setUploadError('Chỉ hỗ trợ JPEG/PNG/WebP/GIF.');
      return;
    }
    setUploading(true);
    try {
      const presign = await bffRequest<PresignResult>(
        'media',
        'media/presign',
        {
          method: 'POST',
          body: {
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            ownerType: 'product',
            ownerId: entityId,
            role: isPrimary ? 'thumbnail' : 'gallery',
          },
        },
      );
      const putUrl = browserUploadUrl(presign.uploadUrl);
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload MinIO thất bại (${putRes.status})`);
      }
      await bffRequest('media', `media/${presign.mediaId}/confirm`, {
        method: 'POST',
        body: {},
      });
      await bffRequest('media', `media/${presign.mediaId}/links`, {
        method: 'POST',
        body: {
          entityType: 'product',
          entityId,
          role: isPrimary ? 'thumbnail' : 'gallery',
          sortOrder: 0,
          isPrimary,
        },
      });
      showToast('Đã upload và gắn media', 'success');
      form.reset();
      refetch();
    } catch (err) {
      const msg = getErrorMessage(err, 'Upload thất bại');
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Media</div>
          <div className="nx-page-subtitle">
            Chọn sản phẩm, tra cứu và upload ảnh (presign → MinIO → confirm →
            link)
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          marginBottom: '1rem',
          padding: '1rem',
          border: '1px solid var(--nx-border, #dbeafe)',
          borderRadius: 12,
          background: '#fff',
          maxWidth: 720,
        }}
      >
        <label>
          Tìm sản phẩm
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Tên / slug…"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Chọn sản phẩm
          <select
            value={entityType === 'product' ? entityId : ''}
            onChange={(e) => {
              const id = e.target.value;
              setEntityType('product');
              setEntityId(id);
              setEntityIdInput(id);
            }}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="">— Chọn sản phẩm —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.slug ? ` (${p.slug})` : ''}
              </option>
            ))}
          </select>
        </label>

        {entityId ? (
          <form onSubmit={onUpload} style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              File ảnh
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'block', marginTop: 4 }}
              />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Đặt làm ảnh chính (thumbnail)
            </label>
            {uploadError ? (
              <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
                {uploadError}
              </p>
            ) : null}
            <button
              type="submit"
              className="nx-btn nx-btn-primary"
              disabled={uploading}
            >
              {uploading ? 'Đang upload…' : 'Upload & gắn media'}
            </button>
          </form>
        ) : null}
      </div>

      <ListToolbar
        searchValue={entityIdInput}
        onSearchChange={setEntityIdInput}
        searchPlaceholder="Entity ID…"
        searchLabel="Entity ID"
        statusValue={entityType}
        onStatusChange={setEntityType}
        statusLabel="Entity type"
        statusOptions={[
          { value: 'product', label: 'product' },
          { value: 'review', label: 'review' },
          { value: 'user', label: 'user' },
        ]}
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'id_asc', label: 'ID A→Z' },
          { value: 'id_desc', label: 'ID Z→A' },
          { value: 'kind_asc', label: 'Loại A→Z' },
          { value: 'kind_desc', label: 'Loại Z→A' },
        ]}
        onApply={() => setEntityId(entityIdInput.trim())}
        onReset={() => {
          setEntityIdInput('');
          setEntityId('');
          setEntityType('product');
          setSort('id_asc');
        }}
      />
      <DataTable
        columns={columns}
        rows={enabled ? sortedItems : []}
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={enabled && loading}
        error={enabled ? error : null}
        onRetry={refetch}
        emptyTitle={enabled ? 'Không có media' : 'Chọn sản phẩm hoặc Entity ID'}
        emptyDescription={
          enabled
            ? 'Entity chưa có media gắn kèm.'
            : 'Chọn sản phẩm ở trên hoặc nhập UUID rồi bấm Áp dụng.'
        }
      />
    </div>
  );
}
