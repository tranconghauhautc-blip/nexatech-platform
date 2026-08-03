'use client';

import Link from 'next/link';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import type { CatalogMediaLinkRow } from '../../../lib/types';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { ListToolbar } from '../../../components/ui/ListToolbar';
import { TextField, SelectField } from '../../../components/ui/form';
import { EmptyState, LoadingState } from '../../../components/ui/states';
import { useToast } from '../../../components/ui/toast';
import {
  ALLOWED_MIME,
  assertBrowserSafeUploadUrl,
  describeMinioPutFailure,
  extractMediaAltText,
  extractMediaMime,
  extractMediaSizeBytes,
  formatMediaCreatedAt,
  formatMediaDimensions,
  formatMediaSize,
  getMediaPreviewRef,
  isCatalogEmpty,
  MAX_UPLOAD_BYTES,
  MEDIA_CREATE_PRODUCT_HREF,
  MEDIA_EMPTY_CATALOG_DESCRIPTION,
  MEDIA_EMPTY_CATALOG_TITLE,
  mergeCatalogMediaLinks,
  shouldShowUploadControls,
  type MergedMediaRow,
} from './media-page.helpers';
import { MediaPreview } from './media-preview';

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
  contentType?: string;
  expiresIn?: number;
}

export default function Page() {
  const { showToast } = useToast();
  const [entityType, setEntityType] = useState('product');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productQuery, setProductQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catalogLinks, setCatalogLinks] = useState<CatalogMediaLinkRow[]>([]);
  const [catalogLinksLoading, setCatalogLinksLoading] = useState(false);
  const [actionLinkId, setActionLinkId] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const enabled = entityId.length > 0;

  const catalogEmpty = isCatalogEmpty({
    productsLoading,
    productCount: products.length,
    productQuery,
  });

  const showUpload = shouldShowUploadControls({
    entityId,
    entityType,
  });

  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'media',
    path: `media/by-entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId || '_')}`,
    enabled,
  });

  const loadCatalogLinks = useCallback(async () => {
    if (entityType !== 'product' || !entityId) {
      setCatalogLinks([]);
      return;
    }
    setCatalogLinksLoading(true);
    try {
      const links = await bffRequest<CatalogMediaLinkRow[]>(
        'catalog',
        `admin/catalog/products/${entityId}/media-links`,
      );
      setCatalogLinks(Array.isArray(links) ? links : []);
    } catch {
      setCatalogLinks([]);
    } finally {
      setCatalogLinksLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void loadCatalogLinks();
  }, [loadCatalogLinks, items]);

  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productQuery]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.slug ? `${p.name} (${p.slug})` : p.name,
      })),
    [products],
  );

  const mergedRows = useMemo(
    () => mergeCatalogMediaLinks(items, catalogLinks),
    [items, catalogLinks],
  );

  const sortedItems = useMemo(() => {
    const rows = [...mergedRows];
    rows.sort((a, b) => {
      const idA = String(a['id'] ?? '');
      const idB = String(b['id'] ?? '');
      const kindA = extractMediaMime(a);
      const kindB = extractMediaMime(b);
      const createdA = formatMediaCreatedAt(a);
      const createdB = formatMediaCreatedAt(b);
      if (sort === 'id_desc') return idB.localeCompare(idA);
      if (sort === 'kind_asc') return kindA.localeCompare(kindB);
      if (sort === 'kind_desc') return kindB.localeCompare(kindA);
      if (sort === 'created_desc') return createdB.localeCompare(createdA);
      if (sort === 'created_asc') return createdA.localeCompare(createdB);
      return idA.localeCompare(idB);
    });
    return rows;
  }, [mergedRows, sort]);

  async function setCatalogPrimary(linkId: string) {
    if (entityType !== 'product' || !entityId) return;
    setActionLinkId(linkId);
    try {
      await bffRequest(
        'catalog',
        `admin/catalog/products/${entityId}/media-links/${linkId}`,
        {
          method: 'PATCH',
          body: { isPrimary: true, role: 'thumbnail' },
        },
      );
      showToast('Đã đặt ảnh chính', 'success');
      await loadCatalogLinks();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Đặt ảnh chính thất bại'), 'error');
    } finally {
      setActionLinkId(null);
    }
  }

  async function unlinkCatalogMedia(linkId: string, mediaId: string) {
    if (entityType !== 'product' || !entityId) return;
    const ok = window.confirm(
      `Gỡ liên kết media ${mediaId}? File trên MinIO vẫn được giữ.`,
    );
    if (!ok) return;
    setActionLinkId(linkId);
    try {
      await bffRequest(
        'catalog',
        `admin/catalog/products/${entityId}/media-links/${linkId}`,
        { method: 'DELETE' },
      );
      showToast('Đã gỡ liên kết media', 'success');
      await loadCatalogLinks();
      refetch();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gỡ liên kết thất bại'), 'error');
    } finally {
      setActionLinkId(null);
    }
  }

  const columns = useMemo<DataTableColumn<MergedMediaRow>[]>(
    () => [
      {
        key: 'preview',
        header: 'Xem trước',
        render: (r) => (
          <MediaPreview
            mediaRef={getMediaPreviewRef(r)}
            alt={extractMediaAltText(r) !== '—' ? extractMediaAltText(r) : ''}
          />
        ),
      },
      {
        key: 'mime',
        header: 'MIME',
        render: (r) => extractMediaMime(r),
      },
      {
        key: 'dimensions',
        header: 'Kích thước ảnh',
        render: (r) => formatMediaDimensions(r),
      },
      {
        key: 'size',
        header: 'Dung lượng',
        render: (r) => formatMediaSize(extractMediaSizeBytes(r)),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => String(r['status'] ?? '—'),
      },
      {
        key: 'primary',
        header: 'Ảnh chính',
        render: (r) =>
          r.catalogIsPrimary || r.isPrimary ? (
            <Badge tone="success">Chính</Badge>
          ) : (
            '—'
          ),
      },
      {
        key: 'alt',
        header: 'Alt text',
        render: (r) => extractMediaAltText(r),
      },
      {
        key: 'createdAt',
        header: 'Tạo lúc',
        render: (r) => formatMediaCreatedAt(r),
      },
      {
        key: 'actions',
        header: 'Thao tác',
        render: (r) => {
          const linkId = r.catalogLinkId;
          if (!linkId || entityType !== 'product') {
            return '—';
          }
          const busy = actionLinkId === linkId;
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!r.catalogIsPrimary ? (
                <button
                  type="button"
                  className="nx-btn nx-btn-ghost"
                  disabled={busy}
                  onClick={() => setCatalogPrimary(linkId)}
                >
                  Đặt chính
                </button>
              ) : null}
              <button
                type="button"
                className="nx-btn nx-btn-ghost"
                disabled={busy}
                onClick={() =>
                  unlinkCatalogMedia(linkId, String(r['mediaId'] ?? r['id']))
                }
              >
                Gỡ
              </button>
            </div>
          );
        },
      },
    ],
    [actionLinkId, entityType],
  );

  function selectProduct(id: string) {
    setEntityType('product');
    setEntityId(id);
    setEntityIdInput(id);
    setUploadError(null);
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    if (uploadLock.current || uploading) {
      return;
    }
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
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
      setUploadError('Chỉ hỗ trợ JPEG/PNG/WebP/GIF.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `Kích thước file không hợp lệ (tối đa ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).`,
      );
      return;
    }

    uploadLock.current = true;
    setUploading(true);
    let confirmed = false;
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

      const putUrl = assertBrowserSafeUploadUrl(presign.uploadUrl);
      const contentType = presign.contentType || file.type;
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(await describeMinioPutFailure(putRes));
      }

      await bffRequest('media', `media/${presign.mediaId}/confirm`, {
        method: 'POST',
        body: {},
      });
      confirmed = true;

      try {
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
      } catch (linkErr) {
        const linkMsg = getErrorMessage(linkErr, 'Gắn media thất bại');
        if (/đã tồn tại|conflict|CONFLICT/i.test(linkMsg)) {
          showToast('Media đã được gắn (bỏ qua trùng lặp)', 'success');
        } else {
          throw linkErr;
        }
      }

      try {
        await bffRequest(
          'catalog',
          `admin/catalog/products/${entityId}/media-links`,
          {
            method: 'POST',
            body: {
              mediaId: presign.mediaId,
              role: isPrimary ? 'thumbnail' : 'gallery',
              sortOrder: 0,
              isPrimary,
            },
          },
        );
      } catch (catalogLinkErr) {
        const catalogMsg = getErrorMessage(
          catalogLinkErr,
          'Gắn catalog media thất bại',
        );
        if (!/đã tồn tại|conflict|CONFLICT/i.test(catalogMsg)) {
          throw catalogLinkErr;
        }
      }

      showToast('Đã upload và gắn media', 'success');
      form.reset();
      await loadCatalogLinks();
      refetch();
    } catch (err) {
      const msg = getErrorMessage(
        err,
        confirmed
          ? 'Confirm OK nhưng gắn sản phẩm thất bại'
          : 'Upload thất bại',
      );
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Media</div>
          <div className="nx-page-subtitle">
            Chọn sản phẩm rồi upload ảnh (presign → MinIO → confirm → link)
          </div>
        </div>
      </div>

      <div className="nx-card" style={{ maxWidth: 720, width: '100%' }}>
        <div className="nx-card-title">Gắn ảnh sản phẩm</div>

        {productsLoading ? <LoadingState label="Đang tải sản phẩm…" /> : null}

        {!productsLoading && catalogEmpty && !showUpload ? (
          <EmptyState
            title={MEDIA_EMPTY_CATALOG_TITLE}
            description={MEDIA_EMPTY_CATALOG_DESCRIPTION}
            action={
              <Link
                href={MEDIA_CREATE_PRODUCT_HREF}
                className="nx-btn nx-btn-primary"
              >
                Tạo sản phẩm
              </Link>
            }
          />
        ) : null}

        {!productsLoading && !catalogEmpty ? (
          <div className="nx-page" style={{ gap: 14 }}>
            <TextField
              label="Tìm sản phẩm"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Tên / slug…"
              disabled={uploading}
            />
            <SelectField
              label="Chọn sản phẩm"
              value={entityType === 'product' ? entityId : ''}
              onChange={(e) => selectProduct(e.target.value)}
              options={productOptions}
              placeholder="— Chọn sản phẩm —"
              disabled={uploading}
            />
            {!showUpload ? (
              <p className="nx-hint" style={{ margin: 0 }}>
                Chọn một sản phẩm để hiện bộ chọn file và nút upload.
              </p>
            ) : null}
          </div>
        ) : null}

        {showUpload ? (
          <form
            onSubmit={onUpload}
            className="nx-page"
            style={{ gap: 12, marginTop: catalogEmpty ? 0 : 14 }}
            data-testid="media-upload-form"
          >
            {catalogEmpty ? (
              <p className="nx-hint" style={{ margin: 0 }}>
                Đang dùng Entity ID (nâng cao). Nên tạo/chọn sản phẩm từ danh
                mục khi có dữ liệu.
              </p>
            ) : null}
            <div className="nx-field">
              <label className="nx-label" htmlFor="media-upload-file">
                File ảnh
              </label>
              <input
                id="media-upload-file"
                name="file"
                type="file"
                className="nx-input"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
              />
            </div>
            <label className="nx-checkbox-row">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                disabled={uploading}
              />
              Đặt làm ảnh chính (thumbnail)
            </label>
            {uploadError ? (
              <p role="alert" className="nx-error-text" style={{ margin: 0 }}>
                {uploadError}
              </p>
            ) : null}
            <div
              className="nx-form-actions"
              style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}
            >
              <button
                type="submit"
                className="nx-btn nx-btn-primary"
                disabled={uploading}
                aria-busy={uploading}
              >
                {uploading ? 'Đang upload…' : 'Upload & gắn media'}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <details
        className="nx-card"
        style={{ maxWidth: 720, width: '100%' }}
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary
          className="nx-card-title"
          style={{ cursor: 'pointer', listStyle: 'none', marginBottom: 0 }}
        >
          Nâng cao · tra cứu theo Entity ID
        </summary>
        <p className="nx-hint" style={{ margin: '8px 0 14px' }}>
          Dùng khi cần gắn/xem media theo UUID ngoài danh sách sản phẩm. Luồng
          thường ngày chỉ cần chọn sản phẩm ở trên.
        </p>
        <ListToolbar
          searchValue={entityIdInput}
          onSearchChange={setEntityIdInput}
          searchPlaceholder="UUID entity…"
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
            { value: 'created_desc', label: 'Mới nhất' },
            { value: 'created_asc', label: 'Cũ nhất' },
            { value: 'id_asc', label: 'ID A→Z' },
            { value: 'id_desc', label: 'ID Z→A' },
            { value: 'kind_asc', label: 'Loại A→Z' },
            { value: 'kind_desc', label: 'Loại Z→A' },
          ]}
          onApply={() => {
            const id = entityIdInput.trim();
            setEntityId(id);
            if (id) setUploadError(null);
          }}
          onReset={() => {
            setEntityIdInput('');
            setEntityId('');
            setEntityType('product');
            setSort('created_desc');
            setUploadError(null);
          }}
        />
      </details>

      {enabled ? (
        <div className="nx-card">
          <div className="nx-card-title">Media đã gắn</div>
          {catalogLinksLoading ? (
            <p className="nx-hint">Đang đồng bộ liên kết catalog…</p>
          ) : null}
          <DataTable
            columns={columns}
            rows={sortedItems}
            getRowKey={(r) => String(r.id ?? r.mediaId ?? Math.random())}
            loading={loading}
            error={error}
            onRetry={refetch}
            emptyTitle="Không có media"
            emptyDescription="Entity chưa có media gắn kèm."
          />
        </div>
      ) : null}
    </div>
  );
}
