/**
 * Normalizes a Vietnamese name for search/compare: strips diacritics,
 * maps đ/Đ to d/D, lowercases, trims and collapses internal whitespace.
 *
 * Example: "Hà Nội" -> "ha noi", "Đà Nẵng" -> "da nang".
 */
export function normalizeName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
