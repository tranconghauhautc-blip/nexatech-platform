export interface FormatVietnamAddressInput {
  addressLine1: string;
  wardName?: string | null;
  provinceName?: string | null;
  /** Pre-2025-reform district name, kept only for legacy records. */
  legacyDistrictName?: string | null;
}

/**
 * Builds a human-readable Vietnamese address string:
 * "line1, wardName, [legacyDistrictName], provinceName".
 * Empty/missing parts are skipped.
 */
export function formatVietnamAddress(input: FormatVietnamAddressInput): string {
  return [
    input.addressLine1,
    input.wardName,
    input.legacyDistrictName,
    input.provinceName,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
