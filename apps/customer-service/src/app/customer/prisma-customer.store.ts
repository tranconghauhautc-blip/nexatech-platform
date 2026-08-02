import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  CustomerAddress,
  CustomerProfile,
  CustomerStore,
} from './customer.service';
import { PrismaService } from './prisma.service';

function mapProfile(row: {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerProfile {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    phone: row.phone ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAddress(row: {
  id: string;
  customerId: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string | null;
  district: string | null;
  city: string;
  countryCode?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  wardCode?: string | null;
  wardName?: string | null;
  legacyDistrictCode?: string | null;
  legacyDistrictName?: string | null;
  postalCode: string | null;
  isDefault: boolean;
}): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customerId,
    label: row.label,
    recipient: row.recipient,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    ward: row.ward ?? undefined,
    district: row.district ?? undefined,
    city: row.city,
    countryCode: row.countryCode ?? 'VN',
    provinceCode: row.provinceCode ?? undefined,
    provinceName: row.provinceName ?? undefined,
    wardCode: row.wardCode ?? undefined,
    wardName: row.wardName ?? undefined,
    legacyDistrictCode: row.legacyDistrictCode ?? undefined,
    legacyDistrictName: row.legacyDistrictName ?? undefined,
    postalCode: row.postalCode ?? undefined,
    isDefault: row.isDefault,
  };
}

export class PrismaCustomerStore implements CustomerStore {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<CustomerProfile | null> {
    const row = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    return row ? mapProfile(row) : null;
  }

  async createProfile(input: {
    userId: string;
    fullName: string;
    phone?: string;
  }): Promise<CustomerProfile> {
    try {
      const row = await this.prisma.customerProfile.create({
        data: {
          userId: input.userId,
          fullName: input.fullName,
          phone: input.phone,
          preference: { create: {} },
        },
      });
      return mapProfile(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Hồ sơ khách hàng đã tồn tại',
      });
    }
  }

  async updateProfile(profile: CustomerProfile): Promise<CustomerProfile> {
    const row = await this.prisma.customerProfile.update({
      where: { id: profile.id },
      data: {
        fullName: profile.fullName,
        phone: profile.phone ?? null,
      },
    });
    return mapProfile(row);
  }

  async listAddresses(customerId: string): Promise<CustomerAddress[]> {
    const rows = await this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapAddress);
  }

  async createAddress(
    address: Omit<CustomerAddress, 'id'>,
  ): Promise<CustomerAddress> {
    if (address.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId: address.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.address.create({
      data: {
        customerId: address.customerId,
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        ward: address.wardName ?? address.ward,
        district: address.legacyDistrictName ?? address.district,
        city: address.provinceName ?? address.city,
        countryCode: address.countryCode ?? 'VN',
        provinceCode: address.provinceCode,
        provinceName: address.provinceName,
        wardCode: address.wardCode,
        wardName: address.wardName,
        legacyDistrictCode: address.legacyDistrictCode,
        legacyDistrictName: address.legacyDistrictName,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
      },
    });
    return mapAddress(row);
  }

  async updateAddress(address: CustomerAddress): Promise<CustomerAddress> {
    if (address.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          customerId: address.customerId,
          isDefault: true,
          NOT: { id: address.id },
        },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.address.update({
      where: { id: address.id },
      data: {
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        ward: address.wardName ?? address.ward,
        district: address.legacyDistrictName ?? address.district,
        city: address.provinceName ?? address.city,
        countryCode: address.countryCode ?? 'VN',
        provinceCode: address.provinceCode,
        provinceName: address.provinceName,
        wardCode: address.wardCode,
        wardName: address.wardName,
        legacyDistrictCode: address.legacyDistrictCode,
        legacyDistrictName: address.legacyDistrictName,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
      },
    });
    return mapAddress(row);
  }

  async deleteAddress(id: string): Promise<void> {
    await this.prisma.address.delete({ where: { id } });
  }
}
