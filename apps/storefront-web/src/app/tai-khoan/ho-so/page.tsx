'use client';

import {
  formatVietnamAddress,
  validateAddressSelection,
  vietnamAddressFormSchema,
} from '@nexatech/shared-address';
import {
  EMPTY_VIETNAM_ADDRESS_VALUE,
  VietnamAddressSelector,
  type VietnamAddressSelectorErrors,
  type VietnamAddressSelectorValue,
} from '../../../../../../libs/shared/web/src/address';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../../components/common/empty-state';
import { bff, getErrorMessage } from '../../../lib/api-browser';

interface AddressRow {
  id?: string;
  label?: string;
  recipient?: string;
  phone?: string;
  line1?: string;
  isDefault?: boolean;
  displayAddress?: string;
  wardName?: string | null;
  provinceName?: string | null;
  legacyDistrictName?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
}

export default function Page() {
  const [items, setItems] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<VietnamAddressSelectorValue>({
    ...EMPTY_VIETNAM_ADDRESS_VALUE,
    label: 'Nhà',
    isDefault: true,
  });
  const [fieldErrors, setFieldErrors] = useState<VietnamAddressSelectorErrors>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/customer/customers/me/addresses')
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        setItems(list as AddressRow[]);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = vietnamAddressFormSchema.safeParse(form);
    if (!result.success) {
      const nextErrors: VietnamAddressSelectorErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !(key in nextErrors)) {
          (nextErrors as Record<string, string>)[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setFormError('Vui lòng kiểm tra lại thông tin địa chỉ bên dưới.');
      return;
    }

    const { province, ward } = validateAddressSelection({
      provinceCode: form.provinceCode,
      wardCode: form.wardCode,
    });

    setSaving(true);
    try {
      await bff.post('/api/bff/customer/customers/me/addresses', {
        label: form.label?.trim() || 'Nhà',
        recipient: form.recipientName.trim(),
        phone: form.phone.trim(),
        line1: form.addressLine1.trim(),
        line2: form.addressLine2?.trim() || undefined,
        city: province?.name ?? '',
        countryCode: 'VN',
        provinceCode: form.provinceCode,
        provinceName: province?.name,
        wardCode: form.wardCode,
        wardName: ward?.name,
        isDefault: form.isDefault ?? false,
      });
      setForm({
        ...EMPTY_VIETNAM_ADDRESS_VALUE,
        label: 'Nhà',
        isDefault: true,
      });
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không lưu được địa chỉ'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        aria-busy="true"
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description={error}
        action={
          <button
            type="button"
            className="nt-btn nt-btn-primary"
            onClick={load}
          >
            Thử lại
          </button>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Hồ sơ & địa chỉ</h2>

      {items.length === 0 ? (
        <p style={{ color: '#4b6478' }}>
          Chưa có địa chỉ. Thêm địa chỉ bên dưới.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {items.map((record, index) => {
            const id = String(record.id ?? index);
            const display =
              record.displayAddress ||
              formatVietnamAddress({
                addressLine1: record.line1 ?? '',
                wardName: record.wardName ?? record.ward,
                provinceName: record.provinceName ?? record.city,
                legacyDistrictName:
                  record.legacyDistrictName ?? record.district,
              });
            return (
              <li
                key={id}
                style={{
                  border: '1px solid #dbeafe',
                  borderRadius: 12,
                  padding: '0.85rem',
                  background: '#fff',
                }}
              >
                <strong>
                  {record.label ?? 'Địa chỉ'}
                  {record.isDefault ? ' · Mặc định' : ''}
                </strong>
                <div style={{ color: '#4b6478', marginTop: 4 }}>
                  {record.recipient} · {record.phone}
                </div>
                <div style={{ color: '#0b1f3a' }}>{display}</div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={onAdd}
        style={{
          marginTop: '1.25rem',
          display: 'grid',
          gap: '0.65rem',
          maxWidth: 480,
          border: '1px solid #dbeafe',
          borderRadius: 12,
          padding: '1rem',
          background: '#f8fbff',
        }}
      >
        <h3 style={{ margin: 0 }}>Thêm địa chỉ</h3>
        <VietnamAddressSelector
          value={form}
          onChange={setForm}
          errors={fieldErrors}
          disabled={saving}
          idPrefix="profile-address"
        />
        {formError ? (
          <p style={{ color: '#b91c1c', margin: 0 }} role="alert">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          className="nt-btn nt-btn-primary"
          disabled={saving}
        >
          {saving ? 'Đang lưu…' : 'Lưu địa chỉ'}
        </button>
      </form>

      <p style={{ marginTop: '1rem' }}>
        <Link href="/thanh-toan">Đến thanh toán</Link>
      </p>
    </div>
  );
}
