/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appendReference,
  buildLocationSelectOptions,
  buildStockMutationRequest,
  filterStockByLocationId,
  formatLocationOptionLabel,
  formatMovementLocation,
  formatMovementReference,
  formatStockUpdatedAt,
  generateIdempotencyKey,
  resolveLocationTypeLabel,
  resolveMovementTypeLabel,
  STOCK_EMPTY_DESCRIPTION,
  STOCK_EMPTY_TITLE,
  validateStockForm,
} from '../src/app/(admin)/kho-hang/kho-hang-page.helpers';

const pageSource = readFileSync(
  join(__dirname, '../src/app/(admin)/kho-hang/page.tsx'),
  'utf8',
);

describe('Admin Kho hàng page helpers', () => {
  it('builds receive payload with optional note and reference suffix', () => {
    const { path, body } = buildStockMutationRequest({
      mode: 'receive',
      skuCode: 'NT-PHONE-NX1-BLK',
      locationType: 'warehouse',
      locationId: 'wh-uuid',
      quantity: 10,
      note: 'Nhập lần đầu',
      reference: 'PO-001',
      idempotencyKey: 'key-receive-12345678',
    });
    expect(path).toBe('admin/inventory/stock/receive');
    expect(body).toEqual({
      skuCode: 'NT-PHONE-NX1-BLK',
      locationType: 'warehouse',
      locationId: 'wh-uuid',
      quantity: 10,
      idempotencyKey: 'key-receive-12345678',
      note: 'Nhập lần đầu · ref: PO-001',
    });
  });

  it('builds issue payload without note when empty', () => {
    const { path, body } = buildStockMutationRequest({
      mode: 'issue',
      skuCode: 'SKU-A',
      locationType: 'store',
      locationId: 'store-uuid',
      quantity: 2,
      idempotencyKey: 'key-issue-12345678',
    });
    expect(path).toBe('admin/inventory/stock/issue');
    expect(body).toEqual({
      skuCode: 'SKU-A',
      locationType: 'store',
      locationId: 'store-uuid',
      quantity: 2,
      idempotencyKey: 'key-issue-12345678',
    });
  });

  it('builds adjust payload with required reason', () => {
    const { path, body } = buildStockMutationRequest({
      mode: 'adjust',
      skuCode: 'NT-PHONE-NX1-BLK',
      locationType: 'store',
      locationId: 'store-uuid',
      onHand: 5,
      reason: 'Kiểm kê cuối ngày',
      idempotencyKey: 'key-adjust-12345678',
    });
    expect(path).toBe('admin/inventory/stock/adjust');
    expect(body).toMatchObject({
      onHand: 5,
      reason: 'Kiểm kê cuối ngày',
    });
  });

  it('validates form fields by mode', () => {
    expect(
      validateStockForm({
        mode: 'receive',
        skuCode: '',
        locationType: 'warehouse',
        locationId: '',
        quantity: 0,
      }),
    ).toMatchObject({
      skuCode: expect.any(String),
      locationId: expect.any(String),
      quantity: expect.any(String),
    });
    expect(
      validateStockForm({
        mode: 'adjust',
        skuCode: 'SKU',
        locationType: 'warehouse',
        locationId: 'id',
        onHand: -1,
        reason: '',
      }),
    ).toMatchObject({
      onHand: expect.any(String),
      reason: expect.any(String),
    });
  });

  it('filters stock rows by locationId client-side', () => {
    const rows = [
      { skuCode: 'A', locationId: 'loc-1' },
      { skuCode: 'B', locationId: 'loc-2' },
    ];
    expect(filterStockByLocationId(rows, 'loc-1')).toHaveLength(1);
    expect(filterStockByLocationId(rows, '')).toHaveLength(2);
  });

  it('formats location labels and disables inactive options', () => {
    expect(
      formatLocationOptionLabel({
        id: '1',
        code: 'HN-MAIN',
        name: 'Kho Hà Nội',
        isActive: false,
      }),
    ).toContain('HN-MAIN · Kho Hà Nội');
    expect(
      buildLocationSelectOptions([
        { id: '1', code: 'HN-MAIN', isActive: true },
        { id: '2', code: 'OLD', isActive: false },
      ]),
    ).toEqual([
      { value: '1', label: 'HN-MAIN', disabled: false },
      { value: '2', label: 'OLD (ngừng hoạt động)', disabled: true },
    ]);
  });

  it('appends reference to note text', () => {
    expect(appendReference('Ghi chú', 'REF-1')).toBe('Ghi chú · ref: REF-1');
    expect(appendReference('', 'REF-1')).toBe('ref: REF-1');
    expect(appendReference('Only note', '')).toBe('Only note');
  });

  it('generates idempotency keys with minimum length', () => {
    const key = generateIdempotencyKey();
    expect(key.length).toBeGreaterThanOrEqual(8);
  });

  it('formats updatedAt for Vietnamese locale', () => {
    expect(formatStockUpdatedAt(undefined)).toBe('—');
    expect(formatStockUpdatedAt('2026-08-03T10:00:00.000Z')).not.toBe('—');
  });

  it('resolves location type labels', () => {
    expect(resolveLocationTypeLabel('warehouse')).toBe('Kho');
    expect(resolveLocationTypeLabel('store')).toBe('Cửa hàng');
  });

  it('keeps empty stock Vietnamese copy and drawer CTA in page source', () => {
    expect(STOCK_EMPTY_TITLE).toBe('Chưa có tồn kho');
    expect(STOCK_EMPTY_DESCRIPTION).toContain('Nhập / điều chỉnh tồn');
    expect(pageSource).toContain('STOCK_EMPTY_TITLE');
    expect(pageSource).toContain('Nhập / điều chỉnh tồn');
    expect(pageSource).toContain('buildStockMutationRequest');
    expect(pageSource).toContain('generateIdempotencyKey');
    expect(pageSource).toContain('Drawer');
    expect(pageSource).toContain('SelectField');
    expect(pageSource).toContain("'movements'");
    expect(pageSource).toContain('Lịch sử');
  });

  it('formats movement type, location and reference', () => {
    expect(resolveMovementTypeLabel('IN')).toBe('Nhập');
    expect(resolveMovementTypeLabel('ADJUST')).toBe('Điều chỉnh');
    expect(
      formatMovementLocation(
        { locationType: 'warehouse', locationId: 'wh-1' },
        { 'wh-1': 'HN-MAIN · Kho Hà Nội' },
      ),
    ).toContain('Kho Hà Nội');
    expect(
      formatMovementReference({
        note: 'Nhập lần đầu',
        referenceType: 'PO',
        referenceId: '001',
      }),
    ).toContain('PO: 001');
  });
});
