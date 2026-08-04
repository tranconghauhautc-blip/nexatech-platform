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
} from '@nexatech/shared-web/address';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AccountPageHeader } from '../../../components/account/account-page-header';
import { EmptyState } from '../../../components/common/empty-state';
import { useAuth } from '../../../components/providers/auth-provider';
import { bff, getErrorMessage } from '../../../lib/api-browser';
import { flattenZodErrors, profileFormSchema } from '../../../lib/validation';
import styles from './page.module.css';

interface CustomerProfile {
  id?: string;
  userId?: string;
  fullName?: string;
  phone?: string | null;
}

interface AddressRow {
  id?: string;
  label?: string;
  recipient?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  isDefault?: boolean;
  displayAddress?: string;
  wardName?: string | null;
  provinceName?: string | null;
  provinceCode?: string | null;
  wardCode?: string | null;
  legacyDistrictName?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
}

function addressToForm(record: AddressRow): VietnamAddressSelectorValue {
  return {
    label: record.label ?? 'Nhà',
    recipientName: record.recipient ?? '',
    phone: record.phone ?? '',
    provinceCode: record.provinceCode ?? '',
    wardCode: record.wardCode ?? '',
    addressLine1: record.line1 ?? '',
    addressLine2: record.line2 ?? '',
    isDefault: record.isDefault ?? false,
  };
}

function buildAddressPayload(form: VietnamAddressSelectorValue) {
  const { province, ward } = validateAddressSelection({
    provinceCode: form.provinceCode,
    wardCode: form.wardCode,
  });
  return {
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
  };
}

export default function Page() {
  const { user, refresh: refreshAuth } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [items, setItems] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Record<string, string>
  >({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [form, setForm] = useState<VietnamAddressSelectorValue>({
    ...EMPTY_VIETNAM_ADDRESS_VALUE,
    label: 'Nhà',
    isDefault: false,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<VietnamAddressSelectorErrors>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VietnamAddressSelectorValue>({
    ...EMPTY_VIETNAM_ADDRESS_VALUE,
    label: 'Nhà',
  });
  const [editFieldErrors, setEditFieldErrors] =
    useState<VietnamAddressSelectorErrors>({});
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removingAddressId, setRemovingAddressId] = useState<string | null>(
    null,
  );
  const [addressActionId, setAddressActionId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/customer/customers/me')
      .then(async (me) => {
        const p = me as CustomerProfile;
        setProfile(p);
        setFullName(String(p.fullName ?? ''));
        setPhone(String(p.phone ?? ''));
        const addresses = await bff.get(
          '/api/bff/customer/customers/me/addresses',
        );
        const list = Array.isArray(addresses)
          ? addresses
          : ((addresses as { items?: unknown[] })?.items ?? []);
        setItems(list as AddressRow[]);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profileSuccess) {
      return;
    }
    const timer = window.setTimeout(() => setProfileSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [profileSuccess]);

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setProfileFieldErrors({});

    const parsed = profileFormSchema.safeParse({ fullName, phone });
    if (!parsed.success) {
      setProfileFieldErrors(flattenZodErrors(parsed.error));
      setProfileError('Vui lòng kiểm tra lại thông tin hồ sơ.');
      return;
    }

    setSavingProfile(true);
    setProfileSuccess(null);
    try {
      const updated = await bff.put<CustomerProfile>(
        '/api/bff/customer/customers/me',
        {
          fullName: parsed.data.fullName,
          phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : '',
        },
      );
      setProfile(updated);
      setFullName(String(updated.fullName ?? ''));
      setPhone(String(updated.phone ?? ''));
      setEditing(false);
      setProfileSuccess('Đã cập nhật hồ sơ.');
      await refreshAuth();
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Không lưu được hồ sơ'));
    } finally {
      setSavingProfile(false);
    }
  }

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

    setSaving(true);
    try {
      await bff.post(
        '/api/bff/customer/customers/me/addresses',
        buildAddressPayload(form),
      );
      setForm({
        ...EMPTY_VIETNAM_ADDRESS_VALUE,
        label: 'Nhà',
        isDefault: false,
      });
      setShowAddForm(false);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không lưu được địa chỉ'));
    } finally {
      setSaving(false);
    }
  }

  function startEditAddress(record: AddressRow) {
    const id = String(record.id ?? '');
    if (!id) {
      return;
    }
    setEditingAddressId(id);
    setEditForm(addressToForm(record));
    setEditFieldErrors({});
    setEditFormError(null);
    setRemovingAddressId(null);
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingAddressId) {
      return;
    }
    setEditFormError(null);
    setEditFieldErrors({});

    const result = vietnamAddressFormSchema.safeParse(editForm);
    if (!result.success) {
      const nextErrors: VietnamAddressSelectorErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !(key in nextErrors)) {
          (nextErrors as Record<string, string>)[key] = issue.message;
        }
      }
      setEditFieldErrors(nextErrors);
      setEditFormError('Vui lòng kiểm tra lại thông tin địa chỉ bên dưới.');
      return;
    }

    setSavingEdit(true);
    try {
      await bff.put(
        `/api/bff/customer/customers/me/addresses/${encodeURIComponent(editingAddressId)}`,
        buildAddressPayload(editForm),
      );
      setEditingAddressId(null);
      await load();
    } catch (err) {
      setEditFormError(getErrorMessage(err, 'Không cập nhật được địa chỉ'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function onSetDefault(addressId: string) {
    setAddressActionId(addressId);
    try {
      await bff.put(
        `/api/bff/customer/customers/me/addresses/${encodeURIComponent(addressId)}`,
        { isDefault: true },
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Không đặt được địa chỉ mặc định'));
    } finally {
      setAddressActionId(null);
    }
  }

  async function onRemoveAddress(addressId: string) {
    setAddressActionId(addressId);
    try {
      await bff.delete(
        `/api/bff/customer/customers/me/addresses/${encodeURIComponent(addressId)}`,
      );
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
      }
      setRemovingAddressId(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Không xóa được địa chỉ'));
    } finally {
      setAddressActionId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        role="status"
        aria-busy="true"
      >
        Đang tải hồ sơ…
      </div>
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

  const displayName =
    profile?.fullName?.trim() || user?.email?.split('@')[0] || 'Khách hàng';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className={styles.page}>
      <AccountPageHeader
        title="Hồ sơ & địa chỉ"
        description="Cập nhật thông tin cá nhân và địa chỉ giao hàng."
      />

      <section className={styles.hero}>
        <div className={styles.avatar} aria-hidden="true">
          {initials || 'N'}
        </div>
        <div className={styles.heroBody}>
          <h3 className={styles.heroName}>{displayName}</h3>
          <p className={styles.heroMeta}>{user?.email || '—'}</p>
          <span className={styles.badge}>Thành viên NexaTech</span>
        </div>
        {!editing ? (
          <button
            type="button"
            className="nt-btn nt-btn-secondary"
            onClick={() => {
              setEditing(true);
              setProfileError(null);
              setProfileSuccess(null);
              setProfileFieldErrors({});
              setFullName(String(profile?.fullName ?? ''));
              setPhone(String(profile?.phone ?? ''));
            }}
          >
            Chỉnh sửa
          </button>
        ) : null}
      </section>

      {profileSuccess ? (
        <p className={styles.success} role="status">
          {profileSuccess}
        </p>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Thông tin cá nhân</h3>
        </div>

        {!editing ? (
          <dl className={styles.dl}>
            <div>
              <dt className={styles.dt}>Họ và tên</dt>
              <dd className={styles.dd}>{profile?.fullName || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Email</dt>
              <dd className={styles.dd}>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt className={styles.dt}>Số điện thoại</dt>
              <dd className={styles.dd}>{profile?.phone || '—'}</dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={onSaveProfile} className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Họ và tên
              <input
                className="nt-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={savingProfile}
                autoComplete="name"
              />
              {profileFieldErrors['fullName'] ? (
                <span className={styles.fieldError}>
                  {profileFieldErrors['fullName']}
                </span>
              ) : null}
            </label>
            <label className={styles.fieldLabel}>
              Email (chỉ đọc)
              <input
                className="nt-input"
                value={user?.email ?? ''}
                readOnly
                disabled
              />
            </label>
            <label className={styles.fieldLabel}>
              Số điện thoại
              <input
                className="nt-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={savingProfile}
                placeholder="090xxxxxxx"
                autoComplete="tel"
              />
              {profileFieldErrors['phone'] ? (
                <span className={styles.fieldError}>
                  {profileFieldErrors['phone']}
                </span>
              ) : null}
            </label>
            {profileError ? (
              <p className={styles.error} role="alert">
                {profileError}
              </p>
            ) : null}
            <div className={styles.actions}>
              <button
                type="submit"
                className="nt-btn nt-btn-primary"
                disabled={savingProfile}
              >
                {savingProfile ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </button>
              <button
                type="button"
                className="nt-btn nt-btn-ghost"
                disabled={savingProfile}
                onClick={() => {
                  setEditing(false);
                  setProfileError(null);
                  setProfileFieldErrors({});
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Địa chỉ giao hàng</h3>
          {!showAddForm ? (
            <button
              type="button"
              className="nt-btn nt-btn-secondary"
              onClick={() => {
                setShowAddForm(true);
                setFormError(null);
                setFieldErrors({});
              }}
            >
              Thêm địa chỉ
            </button>
          ) : null}
        </div>

        {items.length === 0 && !showAddForm ? (
          <p className={styles.emptyHint}>
            Chưa có địa chỉ. Nhấn &quot;Thêm địa chỉ&quot; để thanh toán nhanh
            hơn.
          </p>
        ) : items.length === 0 ? (
          <p className={styles.emptyHint}>Chưa có địa chỉ đã lưu.</p>
        ) : (
          <ul className={styles.addressList}>
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
              const isEditing = editingAddressId === id;
              const isRemoving = removingAddressId === id;
              const isBusy = addressActionId === id;
              return (
                <li key={id} className={styles.addressCard}>
                  {isEditing ? (
                    <form onSubmit={onSaveEdit} className={styles.formGrid}>
                      <h4 className={styles.cardTitle}>Chỉnh sửa địa chỉ</h4>
                      <VietnamAddressSelector
                        value={editForm}
                        onChange={setEditForm}
                        errors={editFieldErrors}
                        disabled={savingEdit}
                        idPrefix={`edit-address-${id}`}
                      />
                      {editFormError ? (
                        <p className={styles.error} role="alert">
                          {editFormError}
                        </p>
                      ) : null}
                      <div className={styles.actions}>
                        <button
                          type="submit"
                          className="nt-btn nt-btn-primary"
                          disabled={savingEdit}
                        >
                          {savingEdit ? 'Đang lưu…' : 'Lưu thay đổi'}
                        </button>
                        <button
                          type="button"
                          className="nt-btn nt-btn-ghost"
                          disabled={savingEdit}
                          onClick={() => setEditingAddressId(null)}
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className={styles.addressTitle}>
                        <span>{record.label ?? 'Địa chỉ'}</span>
                        {record.isDefault ? (
                          <span className={styles.defaultBadge}>Mặc định</span>
                        ) : null}
                      </div>
                      <div className={styles.muted}>
                        {record.recipient} · {record.phone}
                      </div>
                      <div style={{ marginTop: 4, color: '#0b1f3a' }}>
                        {display}
                      </div>
                      <div className={styles.actions} style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="nt-btn nt-btn-ghost"
                          disabled={isBusy}
                          onClick={() => startEditAddress(record)}
                        >
                          Chỉnh sửa
                        </button>
                        {!record.isDefault ? (
                          <button
                            type="button"
                            className="nt-btn nt-btn-ghost"
                            disabled={isBusy}
                            onClick={() => onSetDefault(id)}
                          >
                            {isBusy ? 'Đang xử lý…' : 'Đặt mặc định'}
                          </button>
                        ) : null}
                        {isRemoving ? (
                          <>
                            <span className={styles.muted}>
                              Xóa địa chỉ này?
                            </span>
                            <button
                              type="button"
                              className="nt-btn nt-btn-primary"
                              disabled={isBusy}
                              onClick={() => onRemoveAddress(id)}
                            >
                              {isBusy ? 'Đang xóa…' : 'Xác nhận xóa'}
                            </button>
                            <button
                              type="button"
                              className="nt-btn nt-btn-ghost"
                              disabled={isBusy}
                              onClick={() => setRemovingAddressId(null)}
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="nt-btn nt-btn-ghost"
                            disabled={isBusy}
                            onClick={() => setRemovingAddressId(id)}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {showAddForm ? (
        <form
          onSubmit={onAdd}
          className={`${styles.addCard} ${styles.formGrid}`}
        >
          <h3 className={styles.cardTitle}>Thêm địa chỉ</h3>
          <VietnamAddressSelector
            value={form}
            onChange={setForm}
            errors={fieldErrors}
            disabled={saving}
            idPrefix="profile-address"
          />
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="submit"
              className="nt-btn nt-btn-primary"
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu địa chỉ'}
            </button>
            <button
              type="button"
              className="nt-btn nt-btn-ghost"
              disabled={saving}
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
                setFieldErrors({});
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
