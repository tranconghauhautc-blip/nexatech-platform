'use client';

import {
  getWardsByProvince,
  loadProvinces,
  normalizeName,
  type AddressInput,
  type Province,
  type Ward,
} from '@nexatech/shared-address';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type VietnamAddressSelectorValue = AddressInput;

export type VietnamAddressSelectorErrors = Partial<
  Record<
    | 'label'
    | 'recipientName'
    | 'phone'
    | 'provinceCode'
    | 'wardCode'
    | 'addressLine1'
    | 'addressLine2',
    string
  >
>;

export interface VietnamAddressSelectorProps {
  value: VietnamAddressSelectorValue;
  onChange: (next: VietnamAddressSelectorValue) => void;
  errors?: VietnamAddressSelectorErrors;
  disabled?: boolean;
  /** Hide the "đặt làm địa chỉ mặc định" checkbox (e.g. single-address checkout flows). */
  showIsDefault?: boolean;
  idPrefix?: string;
}

const fieldStyle: React.CSSProperties = { display: 'grid', gap: 4 };
const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#0b1f3a',
  fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem 0.65rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};
const errorStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#b91c1c',
};

function inputStyleWith(hasError?: string): React.CSSProperties {
  return hasError ? { ...inputStyle, borderColor: '#f87171' } : inputStyle;
}

interface ComboboxOption {
  code: string;
  name: string;
  normalizedName: string;
}

interface AddressComboboxProps<T extends ComboboxOption> {
  id: string;
  label: string;
  placeholder: string;
  emptyHint: string;
  options: T[];
  selectedCode: string;
  onSelect: (option: T | null) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

/**
 * Searchable single-select combobox. The user filters by typing, then picks
 * an option from the list — the underlying code is only ever set from a
 * real dataset record, never from free-typed text.
 */
function AddressCombobox<T extends ComboboxOption>({
  id,
  label,
  placeholder,
  emptyHint,
  options,
  selectedCode,
  onSelect,
  disabled,
  error,
  required,
}: AddressComboboxProps<T>) {
  const selected = useMemo(
    () => options.find((o) => o.code === selectedCode) ?? null,
    [options, selectedCode],
  );
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [selected]);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return options;
    return options.filter(
      (o) => o.normalizedName.includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [options, query]);

  function commitSelection(option: T | null) {
    onSelect(option);
    setQuery(option?.name ?? '');
    setOpen(false);
  }

  function handleBlur() {
    // Delay so a click on an option (which also blurs the input) can register first.
    window.setTimeout(() => {
      setOpen(false);
      setQuery(selected?.name ?? '');
    }, 120);
  }

  return (
    <div style={fieldStyle} ref={containerRef}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          disabled={disabled || options.length === 0}
          value={query}
          placeholder={options.length === 0 ? emptyHint : placeholder}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery(selected?.name ?? '');
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length === 1) commitSelection(filtered[0]);
            }
          }}
          style={inputStyleWith(error)}
        />
        {open && !disabled && options.length > 0 ? (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            style={{
              position: 'absolute',
              zIndex: 20,
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: 240,
              overflowY: 'auto',
              margin: 0,
              padding: 4,
              listStyle: 'none',
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(15, 34, 63, 0.12)',
            }}
          >
            {filtered.length === 0 ? (
              <li
                style={{
                  padding: '0.5rem 0.65rem',
                  color: '#64748b',
                  fontSize: '0.85rem',
                }}
              >
                Không tìm thấy kết quả phù hợp
              </li>
            ) : (
              filtered.slice(0, 200).map((option) => (
                <li
                  key={option.code}
                  role="option"
                  aria-selected={option.code === selectedCode}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitSelection(option)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.45rem 0.6rem',
                      borderRadius: 6,
                      border: 'none',
                      background:
                        option.code === selectedCode
                          ? '#e0f0ff'
                          : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    {option.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {error ? <span style={errorStyle}>{error}</span> : null}
    </div>
  );
}

/**
 * Full Vietnam delivery-address form field group: searchable province/ward
 * comboboxes (ward filtered by province, reset on province change) plus
 * recipient name, phone, address lines, optional label and "default
 * address" toggle. Users never type raw administrative codes.
 */
export function VietnamAddressSelector({
  value,
  onChange,
  errors,
  disabled,
  showIsDefault = true,
  idPrefix,
}: VietnamAddressSelectorProps) {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;

  const provinces = useMemo<Province[]>(
    () =>
      [...loadProvinces()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [],
  );
  const wards = useMemo<Ward[]>(
    () => getWardsByProvince(value.provinceCode),
    [value.provinceCode],
  );

  function patch(next: Partial<VietnamAddressSelectorValue>) {
    onChange({ ...value, ...next });
  }

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={fieldStyle}>
        <label htmlFor={`${prefix}-label`} style={labelStyle}>
          Nhãn địa chỉ
        </label>
        <input
          id={`${prefix}-label`}
          value={value.label ?? ''}
          disabled={disabled}
          placeholder="Nhà, Công ty, …"
          onChange={(e) => patch({ label: e.target.value })}
          style={inputStyleWith(errors?.label)}
        />
        {errors?.label ? <span style={errorStyle}>{errors.label}</span> : null}
      </div>

      <div style={fieldStyle}>
        <label htmlFor={`${prefix}-recipient`} style={labelStyle}>
          Người nhận *
        </label>
        <input
          id={`${prefix}-recipient`}
          required
          disabled={disabled}
          value={value.recipientName}
          onChange={(e) => patch({ recipientName: e.target.value })}
          style={inputStyleWith(errors?.recipientName)}
        />
        {errors?.recipientName ? (
          <span style={errorStyle}>{errors.recipientName}</span>
        ) : null}
      </div>

      <div style={fieldStyle}>
        <label htmlFor={`${prefix}-phone`} style={labelStyle}>
          Số điện thoại *
        </label>
        <input
          id={`${prefix}-phone`}
          required
          type="tel"
          disabled={disabled}
          value={value.phone}
          onChange={(e) => patch({ phone: e.target.value })}
          style={inputStyleWith(errors?.phone)}
        />
        {errors?.phone ? <span style={errorStyle}>{errors.phone}</span> : null}
      </div>

      <AddressCombobox
        id={`${prefix}-province`}
        label="Tỉnh / Thành phố *"
        placeholder="Gõ để tìm tỉnh/thành phố…"
        emptyHint="Không có dữ liệu tỉnh/thành phố"
        options={provinces}
        selectedCode={value.provinceCode}
        disabled={disabled}
        required
        error={errors?.provinceCode}
        onSelect={(province) =>
          patch({
            provinceCode: province?.code ?? '',
            // Reset ward whenever the province changes.
            wardCode: '',
          })
        }
      />

      <AddressCombobox
        id={`${prefix}-ward`}
        label="Phường / Xã *"
        placeholder="Gõ để tìm phường/xã…"
        emptyHint="Vui lòng chọn tỉnh/thành phố trước"
        options={wards}
        selectedCode={value.wardCode}
        disabled={disabled || !value.provinceCode}
        required
        error={errors?.wardCode}
        onSelect={(ward) => patch({ wardCode: ward?.code ?? '' })}
      />

      <div style={fieldStyle}>
        <label htmlFor={`${prefix}-line1`} style={labelStyle}>
          Địa chỉ cụ thể *
        </label>
        <input
          id={`${prefix}-line1`}
          required
          disabled={disabled}
          placeholder="Số nhà, tên đường"
          value={value.addressLine1}
          onChange={(e) => patch({ addressLine1: e.target.value })}
          style={inputStyleWith(errors?.addressLine1)}
        />
        {errors?.addressLine1 ? (
          <span style={errorStyle}>{errors.addressLine1}</span>
        ) : null}
      </div>

      <div style={fieldStyle}>
        <label htmlFor={`${prefix}-line2`} style={labelStyle}>
          Địa chỉ bổ sung
        </label>
        <input
          id={`${prefix}-line2`}
          disabled={disabled}
          placeholder="Tòa nhà, tầng, ghi chú giao hàng…"
          value={value.addressLine2 ?? ''}
          onChange={(e) => patch({ addressLine2: e.target.value })}
          style={inputStyleWith(errors?.addressLine2)}
        />
        {errors?.addressLine2 ? (
          <span style={errorStyle}>{errors.addressLine2}</span>
        ) : null}
      </div>

      {showIsDefault ? (
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: '0.9rem',
          }}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(value.isDefault)}
            onChange={(e) => patch({ isDefault: e.target.checked })}
          />
          Đặt làm địa chỉ mặc định
        </label>
      ) : null}
    </div>
  );
}

export const EMPTY_VIETNAM_ADDRESS_VALUE: VietnamAddressSelectorValue = {
  label: '',
  recipientName: '',
  phone: '',
  provinceCode: '',
  wardCode: '',
  addressLine1: '',
  addressLine2: '',
  isDefault: false,
};
