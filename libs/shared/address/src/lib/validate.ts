import { getProvinceByCode, getWardByCode } from './dataset';
import type { Province, Ward } from './types';

export interface AddressSelectionInput {
  provinceCode?: string | null;
  wardCode?: string | null;
}

export interface AddressSelectionResult {
  valid: boolean;
  errors: string[];
  province?: Province;
  ward?: Ward;
}

/**
 * Validates a province/ward selection against the Vietnam administrative
 * dataset: both must exist, and the ward must belong to the selected
 * province. Returns Vietnamese error messages suitable for direct display.
 */
export function validateAddressSelection(
  input: AddressSelectionInput,
): AddressSelectionResult {
  const errors: string[] = [];
  const provinceCode = input.provinceCode?.trim();
  const wardCode = input.wardCode?.trim();

  if (!provinceCode) {
    errors.push('Vui lòng chọn tỉnh/thành phố');
    return { valid: false, errors };
  }

  const province = getProvinceByCode(provinceCode);
  if (!province) {
    errors.push('Tỉnh/thành phố không hợp lệ');
    return { valid: false, errors };
  }

  if (!wardCode) {
    errors.push('Vui lòng chọn phường/xã');
    return { valid: false, errors, province };
  }

  const ward = getWardByCode(wardCode);
  if (!ward) {
    errors.push('Phường/xã không hợp lệ');
    return { valid: false, errors, province };
  }

  if (ward.parentCode !== province.code) {
    errors.push('Phường/xã không thuộc tỉnh/thành phố đã chọn');
    return { valid: false, errors, province, ward };
  }

  return { valid: true, errors: [], province, ward };
}
