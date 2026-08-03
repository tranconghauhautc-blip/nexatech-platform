const SECRET_KEY_PATTERN =
  /password|secret|token|hash|credential|api[_-]?key|authorization/i;

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export function shortenId(id: string, head = 8, tail = 4): string {
  if (!id) return '—';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function pickHumanLabel(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  if (!metadata) return undefined;
  for (const key of [
    'name',
    'productName',
    'orderNumber',
    'orderCode',
    'skuCode',
    'ticketCode',
    'claimCode',
    'title',
    'subject',
  ]) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function formatAuditResource(
  resourceType: unknown,
  resourceId: unknown,
  details?: Record<string, unknown>,
): { primary: string; secondary?: string } {
  const type = String(resourceType ?? '—');
  const id = String(resourceId ?? '');
  const label = pickHumanLabel(details);
  const shortId = id ? shortenId(id) : '';
  const primary = label
    ? `${type} · ${label}`
    : `${type}${shortId ? ` · ${shortId}` : ''}`;
  return {
    primary,
    secondary: label && id ? id : undefined,
  };
}

/** Loại bỏ trường nhạy cảm trước khi hiển thị JSON audit. */
export function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[…]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = redactSensitiveFields(nested, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function clientFilterRows<T>(
  rows: T[],
  term: string,
  pickers: Array<(row: T) => string | undefined | null | number | boolean>,
): T[] {
  const q = term.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    pickers.some((pick) =>
      String(pick(row) ?? '')
        .toLowerCase()
        .includes(q),
    ),
  );
}
