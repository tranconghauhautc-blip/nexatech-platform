export type ClassValue = string | number | false | null | undefined;

/** Ghép class name, bỏ qua giá trị falsy — tránh phụ thuộc thêm thư viện ngoài. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
