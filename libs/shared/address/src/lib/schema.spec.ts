import { vietnamAddressFormSchema } from './schema';
import { loadWards } from './dataset';

const hanoiWard = loadWards().find((w) => w.parentCode === '01');

function baseValues() {
  return {
    recipientName: 'Nguyễn Văn Test',
    phone: '0901234567',
    provinceCode: '01',
    wardCode: hanoiWard?.code ?? '',
    addressLine1: '123 Đường Nguyễn Huệ',
  };
}

describe('vietnamAddressFormSchema', () => {
  it('accepts a fully valid address', () => {
    const result = vietnamAddressFormSchema.safeParse(baseValues());
    expect(result.success).toBe(true);
  });

  it('accepts optional fields when provided', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      label: 'Nhà',
      addressLine2: 'Tầng 3',
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts the +84 international phone format', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      phone: '+84901234567',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid phone number', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      phone: '12345',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'phone')).toBe(true);
    }
  });

  it('rejects a missing recipient name', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      recipientName: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing provinceCode', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      provinceCode: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a ward that does not belong to the selected province', () => {
    const otherProvinceWard = loadWards().find((w) => w.parentCode === '79');
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      provinceCode: '01',
      wardCode: otherProvinceWard?.code,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'wardCode')).toBe(
        true,
      );
    }
  });

  it('rejects a too-short addressLine1', () => {
    const result = vietnamAddressFormSchema.safeParse({
      ...baseValues(),
      addressLine1: 'AB',
    });
    expect(result.success).toBe(false);
  });
});
