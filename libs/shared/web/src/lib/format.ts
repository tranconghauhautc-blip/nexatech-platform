const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return vndFormatter.format(Math.round(amount));
}

export function formatNumberVn(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return numberFormatter.format(value);
}

export function formatDateTimeVn(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function formatDateVn(value: string | Date): string {
  return formatDateTimeVn(value, {
    dateStyle: 'medium',
    timeStyle: undefined,
  });
}
