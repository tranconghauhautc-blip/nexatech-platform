import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
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
  postalCode?: string;
  isDefault: boolean;
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

  async getOrCreateMe(userId: string, fullName: string) {
    const existing = await this.store.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.store.createProfile({ userId, fullName });
  }

  async updateMe(userId: string, patch: { fullName?: string; phone?: string }) {
    const profile = await this.store.findByUserId(userId);
    if (!profile) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy hồ sơ khách hàng',
      });
    }
    return this.store.updateProfile({
      ...profile,
      fullName: patch.fullName ?? profile.fullName,
      phone: patch.phone ?? profile.phone,
    });
  }

  async listMyAddresses(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.store.listAddresses(profile.id);
  }

  async addAddress(
    userId: string,
    input: Omit<CustomerAddress, 'id' | 'customerId'>,
  ) {
    const profile = await this.requireProfile(userId);
    return this.store.createAddress({ ...input, customerId: profile.id });
  }

  private async requireProfile(userId: string) {
    const profile = await this.store.findByUserId(userId);
    if (!profile) {
      throw new AppError({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Không tìm thấy hồ sơ khách hàng',
      });
    }
    return profile;
  }
}
