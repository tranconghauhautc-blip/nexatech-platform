/**
 * Domain types for the Vietnam 2-level administrative address model
 * (province/city + ward, post-2025 reform — district level abolished).
 */

export type ProvinceType = 'PROVINCE' | 'MUNICIPALITY';
export type WardType = 'WARD';

interface AdministrativeUnitBase {
  /** Official government unit code (stable, unique within its level). */
  code: string;
  /** Vietnamese display name, diacritics preserved. */
  name: string;
  /** Diacritics-stripped, lowercased, whitespace-collapsed name for search/compare. */
  normalizedName: string;
  /** Dataset snapshot version this record was generated from. */
  sourceVersion: string;
  /** Administrative model effective date this record complies with. */
  effectiveVersion: string;
}

export interface Province extends AdministrativeUnitBase {
  type: ProvinceType;
  parentCode: null;
}

export interface Ward extends AdministrativeUnitBase {
  type: WardType;
  /** Code of the owning province/city. */
  parentCode: string;
}

/**
 * Data a user supplies when creating/updating a delivery address.
 * No raw administrative codes are ever typed by the user — provinceCode/
 * wardCode always come from selecting a Province/Ward record.
 */
export interface AddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  wardCode: string;
  addressLine1: string;
  addressLine2?: string;
  isDefault?: boolean;
}
