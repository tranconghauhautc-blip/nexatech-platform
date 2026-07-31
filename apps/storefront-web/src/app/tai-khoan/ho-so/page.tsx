'use client';

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
  line2?: string;
  ward?: string;
  district?: string;
  city?: string;
  isDefault?: boolean;
}

const EMPTY_FORM = {
  label: 'Nhà',
  recipient: '',
  phone: '',
  line1: '',
  line2: '',
  ward: '',
  district: '',
  city: '',
  isDefault: true,
};

export default function Page() {
  const [items, setItems] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
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
    if (!form.recipient.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim()) {
      setFormError('Vui lòng nhập người nhận, SĐT, địa chỉ và thành phố.');
      return;
    }
    setSaving(true);
    try {
      await bff.post('/api/bff/customer/customers/me/addresses', {
        label: form.label.trim() || 'Nhà',
        recipient: form.recipient.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        ward: form.ward.trim() || undefined,
        district: form.district.trim() || undefined,
        city: form.city.trim(),
        isDefault: form.isDefault,
      });
      setForm(EMPTY_FORM);
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
        <p style={{ color: '#4b6478' }}>Chưa có địa chỉ. Thêm địa chỉ bên dưới.</p>
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
                <div style={{ color: '#0b1f3a' }}>
                  {[record.line1, record.line2, record.ward, record.district, record.city]
                    .filter(Boolean)
                    .join(', ')}
                </div>
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
        <label>
          Nhãn
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Người nhận
          <input
            required
            value={form.recipient}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipient: e.target.value }))
            }
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Số điện thoại
          <input
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Địa chỉ dòng 1
          <input
            required
            value={form.line1}
            onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Địa chỉ dòng 2
          <input
            value={form.line2}
            onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Phường/Xã
          <input
            value={form.ward}
            onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Quận/Huyện
          <input
            value={form.district}
            onChange={(e) =>
              setForm((f) => ({ ...f, district: e.target.value }))
            }
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Tỉnh/Thành phố
          <input
            required
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) =>
              setForm((f) => ({ ...f, isDefault: e.target.checked }))
            }
          />
          Đặt làm địa chỉ mặc định
        </label>
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
