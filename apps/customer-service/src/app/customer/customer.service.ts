import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  formatVietnamAddress,
  validateAddressSelection,
} from '@nexatech/shared-address';
import { Injectable } from '@nestjs/common';

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  city: string;
  countryCode?: string;
  provinceCode?: string;
  provinceName?: string;
  wardCode?: string;
  wardName?: string;
  legacyDistrictCode?: string;
  legacyDistrictName?: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface CustomerAddressWithDisplay extends CustomerAddress {
  /** "line1, wardName, [legacyDistrictName], provinceName" ready for direct display. */
  displayAddress: string;
}

export function withDisplayAddress(
  address: CustomerAddress,
): CustomerAddressWithDisplay {
  return {
    ...address,
    displayAddress: formatVietnamAddress({
      addressLine1: address.line1,
      wardName: address.wardName ?? address.ward,
      provinceName: address.provinceName ?? address.city,
      legacyDistrictName: address.legacyDistrictName ?? address.district,
    }),
  };
}

function assertValidAdministrativeSelection(input: {
  provinceCode?: string;
  wardCode?: string;
}): void {
  // Only cross-validate when the caller supplied the structured 2-level
  // codes — legacy free-text-only addresses (no provinceCode/wardCode) are
  // still accepted for backward compatibility.
  if (!input.provinceCode && !input.wardCode) {
    return;
  }
  const result = validateAddressSelection({
    provinceCode: input.provinceCode,
    wardCode: input.wardCode,
  });
  if (!result.valid) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: result.errors[0] ?? 'Địa chỉ hành chính không hợp lệ',
      details: { errors: result.errors },
    });
  }
}

export interface CustomerStore {
  findByUserId(userId: string): Promise<CustomerProfile | null>;
  createProfile(input: {
    userId: string;
    fullName: string;
    phone?: string;
  }): Promise<CustomerProfile>;
  updateProfile(profile: CustomerProfile): Promise<CustomerProfile>;
  listAddresses(customerId: string): Promise<CustomerAddress[]>;
  createAddress(address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress>;
  updateAddress(address: CustomerAddress): Promise<CustomerAddress>;
  deleteAddress(id: string): Promise<void>;
}

export class InMemoryCustomerStore implements CustomerStore {
  private profiles = new Map<string, CustomerProfile>();
  private byUser = new Map<string, string>();
  private addresses = new Map<string, CustomerAddress>();

  async findByUserId(userId: string): Promise<CustomerProfile | null> {
    const id = this.byUser.get(userId);
    return id ? (this.profiles.get(id) ?? null) : null;
  }

  async createProfile(input: {
    userId: string;
    fullName: string;
    phone?: string;
  }): Promise<CustomerProfile> {
    if (this.byUser.has(input.userId)) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Hồ sơ khách hàng đã tồn tại',
      });
    }
    const now = new Date();
    const profile: CustomerProfile = {
      id: createId(),
      userId: input.userId,
      fullName: input.fullName,
      phone: input.phone,
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(profile.id, profile);
    this.byUser.set(profile.userId, profile.id);
    return profile;
  }

  async updateProfile(profile: CustomerProfile): Promise<CustomerProfile> {
    const next = { ...profile, updatedAt: new Date() };
    this.profiles.set(next.id, next);
    return next;
  }

  async listAddresses(customerId: string): Promise<CustomerAddress[]> {
    return [...this.addresses.values()].filter(
      (a) => a.customerId === customerId,
    );
  }

  async createAddress(
    address: Omit<CustomerAddress, 'id'>,
  ): Promise<CustomerAddress> {
    if (address.isDefault) {
      for (const [id, current] of this.addresses) {
        if (current.customerId === address.customerId && current.isDefault) {
          this.addresses.set(id, { ...current, isDefault: false });
        }
      }
    }
    const created: CustomerAddress = { ...address, id: createId() };
    this.addresses.set(created.id, created);
    return created;
  }

  async updateAddress(address: CustomerAddress): Promise<CustomerAddress> {
    if (address.isDefault) {
      for (const [id, current] of this.addresses) {
        if (
          current.customerId === address.customerId &&
          current.isDefault &&
          id !== address.id
        ) {
          this.addresses.set(id, { ...current, isDefault: false });
        }
      }
    }
    this.addresses.set(address.id, address);
    return address;
  }

  async deleteAddress(id: string): Promise<void> {
    this.addresses.delete(id);
  }
}

@Injectable()
export class CustomerService {
  constructor(
    private readonly store: CustomerStore = new InMemoryCustomerStore(),
  ) {}

  private requireUserId(userId: string | undefined): string {
    const id = String(userId ?? '').trim();
    if (!id) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Thiếu thông tin người dùng',
      });
    }
    return id;
  }

  async getOrCreateMe(userId: string, fullName: string) {
    const uid = this.requireUserId(userId);
    const existing = await this.store.findByUserId(uid);
    if (existing) {
      return existing;
    }
    return this.store.createProfile({
      userId: uid,
      fullName: fullName?.trim() || 'Khách hàng NexaTech',
    });
  }

  async updateMe(userId: string, patch: { fullName?: string; phone?: string }) {
    const uid = this.requireUserId(userId);
    const profile = await this.store.findByUserId(uid);
    if (!profile) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy hồ sơ khách hàng',
      });
    }

    const nextFullName =
      patch.fullName !== undefined
        ? String(patch.fullName).trim()
        : profile.fullName;
    if (!nextFullName || nextFullName.length > 120) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Họ tên không hợp lệ (1–120 ký tự)',
        details: { field: 'fullName' },
      });
    }

    let nextPhone = profile.phone;
    if (patch.phone !== undefined) {
      const raw = String(patch.phone).trim();
      if (raw === '') {
        nextPhone = undefined;
      } else if (!/^(0|\+84)[0-9]{8,10}$/.test(raw)) {
        throw new AppError({
          errorCode: ErrorCodes.VALIDATION_FAILED,
          message: 'Số điện thoại không hợp lệ',
          details: { field: 'phone' },
        });
      } else {
        nextPhone = raw;
      }
    }

    return this.store.updateProfile({
      ...profile,
      fullName: nextFullName,
      phone: nextPhone,
    });
  }

  async listMyAddresses(userId: string) {
    const profile = await this.requireProfile(userId);
    const addresses = await this.store.listAddresses(profile.id);
    return addresses.map(withDisplayAddress);
  }

  async addAddress(
    userId: string,
    input: Omit<CustomerAddress, 'id' | 'customerId'>,
  ) {
    assertValidAdministrativeSelection(input);
    const profile = await this.requireProfile(userId);
    const created = await this.store.createAddress({
      ...input,
      customerId: profile.id,
    });
    return withDisplayAddress(created);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: Partial<Omit<CustomerAddress, 'id' | 'customerId'>>,
  ) {
    assertValidAdministrativeSelection(input);
    const profile = await this.requireProfile(userId);
    const existing = (await this.store.listAddresses(profile.id)).find(
      (a) => a.id === addressId,
    );
    if (!existing) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy địa chỉ',
      });
    }
    const updated = await this.store.updateAddress({ ...existing, ...input });
    return withDisplayAddress(updated);
  }

  async deleteAddress(userId: string, addressId: string) {
    const profile = await this.requireProfile(userId);
    const addresses = await this.store.listAddresses(profile.id);
    const existing = addresses.find((a) => a.id === addressId);
    if (!existing) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy địa chỉ',
      });
    }

    const remaining = addresses.filter((a) => a.id !== addressId);
    if (existing.isDefault && remaining.length > 0) {
      const [nextDefault] = remaining;
      await this.store.updateAddress({ ...nextDefault, isDefault: true });
    }

    await this.store.deleteAddress(addressId);
    return { deleted: true as const };
  }

  private async requireProfile(userId: string) {
    const uid = this.requireUserId(userId);
    const profile = await this.store.findByUserId(uid);
    if (!profile) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy hồ sơ khách hàng',
      });
    }
    return profile;
  }
}
