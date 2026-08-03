/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertBrowserSafeUploadUrl,
  extractMediaMime,
  formatMediaSize,
  getMediaPreviewRef,
  isBrowserSafeHttpUrl,
  isCatalogEmpty,
  mergeCatalogMediaLinks,
  MEDIA_CREATE_PRODUCT_HREF,
  MEDIA_DARK_THEME_CLASS_TOKENS,
  MEDIA_DARK_THEME_FORM_PRIMITIVES,
  MEDIA_EMPTY_CATALOG_TITLE,
  shouldShowUploadControls,
} from '../src/app/(admin)/media/media-page.helpers';

const pageSource = readFileSync(
  join(__dirname, '../src/app/(admin)/media/page.tsx'),
  'utf8',
);

describe('Admin Media page helpers', () => {
  it('detects empty catalog state', () => {
    expect(
      isCatalogEmpty({
        productsLoading: false,
        productCount: 0,
        productQuery: '',
      }),
    ).toBe(true);
    expect(
      isCatalogEmpty({
        productsLoading: true,
        productCount: 0,
        productQuery: '',
      }),
    ).toBe(false);
    expect(
      isCatalogEmpty({
        productsLoading: false,
        productCount: 0,
        productQuery: 'iphone',
      }),
    ).toBe(false);
    expect(
      isCatalogEmpty({
        productsLoading: false,
        productCount: 2,
        productQuery: '',
      }),
    ).toBe(false);
  });

  it('hides upload controls when no product is selected', () => {
    expect(
      shouldShowUploadControls({
        entityId: '',
        entityType: 'product',
      }),
    ).toBe(false);
    expect(
      shouldShowUploadControls({
        entityId: '   ',
        entityType: 'product',
      }),
    ).toBe(false);
    expect(
      shouldShowUploadControls({
        entityId: 'prod-1',
        entityType: 'review',
      }),
    ).toBe(false);
  });

  it('reveals upload controls after product selection', () => {
    expect(
      shouldShowUploadControls({
        entityId: 'c3810407-207b-466c-b5d9-04524c5076b8',
        entityType: 'product',
      }),
    ).toBe(true);
  });

  it('keeps empty catalog Vietnamese copy and create-product route', () => {
    expect(MEDIA_EMPTY_CATALOG_TITLE).toBe('Chưa có sản phẩm để tải ảnh');
    expect(MEDIA_CREATE_PRODUCT_HREF).toBe('/san-pham');
    expect(pageSource).toContain('MEDIA_EMPTY_CATALOG_TITLE');
    expect(pageSource).toContain('MEDIA_CREATE_PRODUCT_HREF');
    expect(pageSource).toContain('Tạo sản phẩm');
  });

  it('uses Admin theme class tokens (no white inline card regression)', () => {
    for (const token of MEDIA_DARK_THEME_CLASS_TOKENS) {
      expect(pageSource).toContain(token);
    }
    for (const primitive of MEDIA_DARK_THEME_FORM_PRIMITIVES) {
      expect(pageSource).toContain(primitive);
    }
    expect(pageSource).not.toMatch(/background:\s*['"]#fff['"]/i);
    expect(pageSource).not.toMatch(/backgroundColor:\s*['"]#fff['"]/i);
    expect(pageSource).not.toMatch(/background:\s*['"]white['"]/i);
  });

  it('gates upload form behind product selection and demotes Entity ID', () => {
    expect(pageSource).toContain('data-testid="media-upload-form"');
    expect(pageSource).toContain('showUpload ?');
    expect(pageSource).toContain('Nâng cao · tra cứu theo Entity ID');
    expect(pageSource).toMatch(/<details[\s\S]*Entity ID/);
    // Primary workflow is product search/select, not a top-level Entity ID input.
    expect(pageSource).toContain('Chọn sản phẩm');
    expect(pageSource).toContain('Tìm sản phẩm');
  });

  it('Entity ID fallback still enables upload without catalog row', () => {
    expect(
      shouldShowUploadControls({
        entityId: 'manual-uuid',
        entityType: 'product',
      }),
    ).toBe(true);
  });

  it('keeps browser-safe MinIO upload URL guard (upload remains functional)', () => {
    expect(() =>
      assertBrowserSafeUploadUrl(
        'http://minio:9000/product-media/x?X-Amz-Signature=abc',
      ),
    ).toThrow(/MINIO_PUBLIC_ENDPOINT|không reachable|Host/i);
    expect(
      assertBrowserSafeUploadUrl(
        'http://localhost:9000/product-media/x?X-Amz-Signature=abc',
      ),
    ).toContain('localhost:9000');
    expect(pageSource).toContain('assertBrowserSafeUploadUrl');
    expect(pageSource).toContain('describeMinioPutFailure');
    expect(pageSource).toContain('uploadLock');
    expect(pageSource).toContain('media/presign');
    expect(pageSource).toContain('confirm');
    expect(pageSource).toContain('media-links');
  });

  it('formats media metadata helpers', () => {
    expect(formatMediaSize(1536)).toBe('1.5 KB');
    expect(formatMediaSize(undefined)).toBe('—');
    expect(isBrowserSafeHttpUrl('http://localhost:9000/x')).toBe(true);
    expect(isBrowserSafeHttpUrl('http://minio:9000/x')).toBe(false);
    expect(
      getMediaPreviewRef({ id: 'm1', url: 'http://localhost:9000/a.jpg' }),
    ).toBe('http://localhost:9000/a.jpg');
    expect(getMediaPreviewRef({ mediaId: 'm2', url: 'bucket/key' })).toBe('m2');
    expect(extractMediaMime({ mimeType: 'image/png' })).toBe('image/png');
  });

  it('merges catalog primary flags into media rows', () => {
    const merged = mergeCatalogMediaLinks(
      [{ id: 'm1', mediaId: 'm1', isPrimary: false }],
      [{ id: 'link-1', mediaId: 'm1', isPrimary: true }],
    );
    expect(merged[0]?.catalogLinkId).toBe('link-1');
    expect(merged[0]?.catalogIsPrimary).toBe(true);
    expect(merged[0]?.isPrimary).toBe(true);
  });

  it('exposes enriched media table columns and catalog link actions', () => {
    expect(pageSource).toContain('MediaPreview');
    expect(pageSource).toContain('formatMediaDimensions');
    expect(pageSource).toContain('extractMediaAltText');
    expect(pageSource).toContain('Đặt chính');
    expect(pageSource).toContain('media-links/${linkId}');
    expect(pageSource).toContain("method: 'DELETE'");
  });
});
