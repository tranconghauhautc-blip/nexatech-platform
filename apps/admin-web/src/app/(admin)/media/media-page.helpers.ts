/**
 * Pure helpers for Admin Media page (unit-testable without DOM/MinIO).
 */

export const MEDIA_EMPTY_CATALOG_TITLE = 'Chưa có sản phẩm để tải ảnh';
export const MEDIA_EMPTY_CATALOG_DESCRIPTION =
  'Tạo sản phẩm trong mục Sản phẩm trước, rồi quay lại đây để upload và gắn ảnh.';
export const MEDIA_CREATE_PRODUCT_HREF = '/san-pham';

export const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isCatalogEmpty(params: {
  productsLoading: boolean;
  productCount: number;
  productQuery: string;
}): boolean {
  return (
    !params.productsLoading &&
    params.productCount === 0 &&
    params.productQuery.trim() === ''
  );
}

export function shouldShowUploadControls(params: {
  entityId: string;
  entityType: string;
}): boolean {
  return params.entityType === 'product' && params.entityId.trim().length > 0;
}

/**
 * Safety net only: media-service should already return a browser-reachable host
 * (MINIO_PUBLIC_ENDPOINT). Never rewrite a signed URL for Docker hostname —
 * that breaks SigV4 (Host mismatch → 403 SignatureDoesNotMatch).
 */
export function assertBrowserSafeUploadUrl(uploadUrl: string): string {
  let url: URL;
  try {
    url = new URL(uploadUrl);
  } catch {
    throw new Error(
      'URL upload không hợp lệ. Kiểm tra MINIO_PUBLIC_ENDPOINT trên media-service.',
    );
  }
  if (url.hostname === 'minio' || url.hostname.endsWith('.internal')) {
    throw new Error(
      `URL MinIO không reachable từ trình duyệt (host=${url.hostname}). ` +
        'Cấu hình MINIO_PUBLIC_ENDPOINT=localhost (Compose) rồi khởi động lại media-service. ' +
        'Không được rewrite host sau khi ký — chữ ký SigV4 sẽ sai.',
    );
  }
  return url.toString();
}

export async function describeMinioPutFailure(res: Response): Promise<string> {
  const requestId =
    res.headers.get('x-amz-request-id') ??
    res.headers.get('x-amz-id-2') ??
    undefined;
  let code = '';
  let message = '';
  try {
    const text = await res.text();
    const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
    const msgMatch = text.match(/<Message>([^<]+)<\/Message>/);
    code = codeMatch?.[1] ?? '';
    message = msgMatch?.[1] ?? text.slice(0, 180);
  } catch {
    // ignore parse errors
  }
  const parts = [
    `Upload MinIO thất bại (HTTP ${res.status})`,
    code ? `mã=${code}` : null,
    message ? `chi tiết=${message}` : null,
    requestId ? `requestId=${requestId}` : null,
  ].filter(Boolean);
  if (code === 'SignatureDoesNotMatch') {
    parts.push(
      'Gợi ý: URL phải được ký với Host trình duyệt dùng (MINIO_PUBLIC_ENDPOINT), không rewrite sau khi ký.',
    );
  }
  if (code === 'AccessDenied' || res.status === 403) {
    parts.push('Kiểm tra CORS MinIO và credential presign.');
  }
  return parts.join(' — ');
}

/** Class tokens the Media page must keep for Admin design-system regression checks. */
export const MEDIA_THEME_CLASS_TOKENS = [
  'nx-page',
  'nx-page-header',
  'nx-page-title',
  'nx-card',
  'nx-btn',
  'nx-btn-primary',
  'nx-field',
  'nx-input',
];

/** @deprecated Alias — Admin is light theme; keep for existing specs. */
export const MEDIA_DARK_THEME_CLASS_TOKENS = MEDIA_THEME_CLASS_TOKENS;

/** Form primitives used on Media page. */
export const MEDIA_THEME_FORM_PRIMITIVES = [
  'nx-page',
  'nx-card',
  'nx-field',
  'nx-label',
  'nx-input',
  'nx-btn',
  'nx-btn-primary',
] as const;

/** Form primitives that apply nx-input / nx-select theme styles. */
export const MEDIA_DARK_THEME_FORM_PRIMITIVES = [
  'TextField',
  'SelectField',
] as const;

export function isBrowserSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname !== 'minio' &&
      !url.hostname.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

/** Prefer direct http URL; otherwise return mediaId for download-url resolution. */
export function getMediaPreviewRef(
  row: Record<string, unknown>,
): string | undefined {
  const url = row['url'];
  if (isBrowserSafeHttpUrl(url)) {
    return url;
  }
  const mediaId = row['mediaId'] ?? row['id'];
  return mediaId ? String(mediaId) : undefined;
}

export function formatMediaSize(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) {
    return '—';
  }
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMediaDimensions(row: Record<string, unknown>): string {
  const media =
    row['media'] && typeof row['media'] === 'object'
      ? (row['media'] as Record<string, unknown>)
      : row;
  const width = media['width'] ?? media['widthPx'];
  const height = media['height'] ?? media['heightPx'];
  if (
    typeof width === 'number' &&
    typeof height === 'number' &&
    width > 0 &&
    height > 0
  ) {
    return `${width}×${height}`;
  }
  return '—';
}

export function formatMediaCreatedAt(row: Record<string, unknown>): string {
  const media =
    row['media'] && typeof row['media'] === 'object'
      ? (row['media'] as Record<string, unknown>)
      : row;
  const raw =
    media['createdAt'] ??
    row['createdAt'] ??
    (row['link'] &&
      typeof row['link'] === 'object' &&
      (row['link'] as Record<string, unknown>)['createdAt']);
  if (!raw) {
    return '—';
  }
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('vi-VN');
}

export function extractMediaAltText(row: Record<string, unknown>): string {
  const media =
    row['media'] && typeof row['media'] === 'object'
      ? (row['media'] as Record<string, unknown>)
      : row;
  const alt = media['altText'] ?? media['alt'];
  return typeof alt === 'string' && alt.trim() ? alt.trim() : '—';
}

export function extractMediaMime(row: Record<string, unknown>): string {
  const kind = row['mimeType'] ?? row['kind'];
  if (typeof kind === 'string' && kind.trim()) {
    return kind;
  }
  const media =
    row['media'] && typeof row['media'] === 'object'
      ? (row['media'] as Record<string, unknown>)
      : undefined;
  const contentType = media?.['contentType'];
  return typeof contentType === 'string' && contentType.trim()
    ? contentType
    : '—';
}

export function extractMediaSizeBytes(
  row: Record<string, unknown>,
): number | undefined {
  const direct = row['sizeBytes'];
  if (typeof direct === 'number') {
    return direct;
  }
  const media =
    row['media'] && typeof row['media'] === 'object'
      ? (row['media'] as Record<string, unknown>)
      : undefined;
  const nested = media?.['sizeBytes'];
  return typeof nested === 'number' ? nested : undefined;
}

export interface MergedMediaRow extends Record<string, unknown> {
  catalogLinkId?: string;
  catalogIsPrimary?: boolean;
}

/** Merge catalog ProductMediaLink metadata into media-service rows by mediaId. */
export function mergeCatalogMediaLinks(
  mediaRows: Record<string, unknown>[],
  catalogLinks: Array<{ id: string; mediaId: string; isPrimary: boolean }>,
): MergedMediaRow[] {
  const byMediaId = new Map(
    catalogLinks.map((link) => [link.mediaId, link] as const),
  );
  return mediaRows.map((row) => {
    const mediaId = String(row['mediaId'] ?? row['id'] ?? '');
    const catalog = byMediaId.get(mediaId);
    return {
      ...row,
      catalogLinkId: catalog?.id,
      catalogIsPrimary: catalog?.isPrimary ?? false,
      isPrimary: catalog?.isPrimary ?? Boolean(row['isPrimary']),
    };
  });
}
