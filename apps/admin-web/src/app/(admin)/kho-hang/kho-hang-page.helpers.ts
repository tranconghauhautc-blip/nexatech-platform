/**
 * Pure helpers for Admin Kho hàng (stock) page — unit-testable without DOM/BFF.
 */

export type StockMutationMode = 'receive' | 'issue' | 'adjust';

export type LocationType = 'warehouse' | 'store';

export interface LocationOption {
  id: string;
  code?: string;
  name?: string;
  isActive?: boolean;
}

export const STOCK_EMPTY_TITLE = 'Chưa có tồn kho';
export const STOCK_EMPTY_DESCRIPTION =
  'Chưa có bản ghi tồn theo SKU/vị trí. Dùng «Nhập / điều chỉnh tồn» để khởi tạo nhập kho hoặc kiểm kê.';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  warehouse: 'Kho',
  store: 'Cửa hàng',
};

export const STOCK_MODE_LABELS: Record<StockMutationMode, string> = {
  receive: 'Nhập kho',
  issue: 'Xuất kho',
  adjust: 'Điều chỉnh tuyệt đối',
};

export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

export function appendReference(
  text: string,
  reference?: string,
): string | undefined {
  const base = text.trim();
  const ref = reference?.trim();
  if (!base && !ref) return undefined;
  if (!ref) return base || undefined;
  if (!base) return `ref: ${ref}`;
  return `${base} · ref: ${ref}`;
}

export interface StockFormInput {
  mode: StockMutationMode;
  skuCode: string;
  locationType: LocationType;
  locationId: string;
  quantity?: number;
  onHand?: number;
  note?: string;
  reason?: string;
  reference?: string;
  idempotencyKey: string;
}

export function buildStockMutationRequest(form: StockFormInput): {
  path: string;
  body: Record<string, unknown>;
} {
  const skuCode = form.skuCode.trim();
  const base = {
    skuCode,
    locationType: form.locationType,
    locationId: form.locationId,
    idempotencyKey: form.idempotencyKey,
  };

  if (form.mode === 'adjust') {
    return {
      path: 'admin/inventory/stock/adjust',
      body: {
        ...base,
        onHand: form.onHand ?? 0,
        reason: appendReference(form.reason ?? '', form.reference) ?? '',
      },
    };
  }

  const note = appendReference(form.note ?? '', form.reference);
  return {
    path:
      form.mode === 'receive'
        ? 'admin/inventory/stock/receive'
        : 'admin/inventory/stock/issue',
    body: {
      ...base,
      quantity: form.quantity ?? 0,
      ...(note ? { note } : {}),
    },
  };
}

export function validateStockForm(
  form: Omit<StockFormInput, 'idempotencyKey'>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.skuCode.trim()) {
    errors.skuCode = 'Nhập mã SKU';
  }
  if (!form.locationId) {
    errors.locationId = 'Chọn vị trí';
  }
  if (form.mode === 'adjust') {
    if (
      form.onHand === undefined ||
      form.onHand < 0 ||
      !Number.isInteger(form.onHand)
    ) {
      errors.onHand = 'Nhập số tồn hợp lệ (số nguyên ≥ 0)';
    }
    if (!form.reason?.trim()) {
      errors.reason = 'Lý do kiểm kê là bắt buộc';
    }
  } else if (
    !form.quantity ||
    form.quantity <= 0 ||
    !Number.isInteger(form.quantity)
  ) {
    errors.quantity = 'Nhập số lượng hợp lệ (số nguyên > 0)';
  }
  return errors;
}

export function formatLocationOptionLabel(loc: LocationOption): string {
  const code = loc.code?.trim();
  const name = loc.name?.trim();
  const inactive = loc.isActive === false ? ' (ngừng hoạt động)' : '';
  if (code && name) return `${code} · ${name}${inactive}`;
  return `${code || name || loc.id}${inactive}`;
}

export function buildLocationSelectOptions(
  locations: LocationOption[],
): Array<{ value: string; label: string; disabled?: boolean }> {
  return locations.map((loc) => ({
    value: loc.id,
    label: formatLocationOptionLabel(loc),
    disabled: loc.isActive === false,
  }));
}

export function formatStockUpdatedAt(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

export function filterStockByLocationId(
  rows: Record<string, unknown>[],
  locationId: string,
): Record<string, unknown>[] {
  if (!locationId) return rows;
  return rows.filter((row) => String(row['locationId'] ?? '') === locationId);
}

export function resolveLocationTypeLabel(value: unknown): string {
  const key = String(value ?? '').toLowerCase();
  if (key === 'warehouse' || key === 'store') {
    return LOCATION_TYPE_LABELS[key];
  }
  return key ? key : '—';
}

export type MovementType =
  | 'IN'
  | 'OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'COMMIT'
  | 'RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUST';

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Nhập',
  OUT: 'Xuất',
  RESERVE: 'Giữ hàng',
  RELEASE: 'Hoàn giữ',
  COMMIT: 'Trừ giữ',
  RETURN: 'Hoàn kho',
  TRANSFER_OUT: 'Điều chuyển đi',
  TRANSFER_IN: 'Điều chuyển đến',
  ADJUST: 'Điều chỉnh',
};

export interface StockMovementRow {
  id: string;
  skuCode: string;
  locationType?: string;
  locationId?: string;
  type: string;
  quantity: number;
  balanceOnHand?: number;
  balanceReserved?: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  actorId?: string;
  createdAt?: string;
}

export function resolveMovementTypeLabel(type: unknown): string {
  const key = String(type ?? '');
  return MOVEMENT_TYPE_LABELS[key] ?? (key || '—');
}

export function formatMovementReference(row: {
  note?: string;
  referenceType?: string;
  referenceId?: string;
}): string {
  const parts: string[] = [];
  if (row.note?.trim()) parts.push(row.note.trim());
  const refType = row.referenceType?.trim();
  const refId = row.referenceId?.trim();
  if (refType || refId) {
    parts.push([refType, refId].filter(Boolean).join(': '));
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatMovementLocation(
  row: { locationType?: string; locationId?: string },
  locationNames: Record<string, string>,
): string {
  const id = String(row.locationId ?? '');
  const typeLabel = resolveLocationTypeLabel(row.locationType);
  if (!id) return typeLabel;
  const name = locationNames[id];
  return name ? `${typeLabel} · ${name}` : `${typeLabel} · ${id}`;
}
