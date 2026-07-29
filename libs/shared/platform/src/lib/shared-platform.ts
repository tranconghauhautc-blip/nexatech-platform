/**
 * NexaTech shared platform primitives used across services and apps.
 */

export const API_VERSIONS = ['v1', 'v2'] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

export const CORRELATION_HEADERS = {
  requestId: 'x-request-id',
  traceId: 'x-trace-id',
} as const;

export const PLATFORM_NAME = 'NexaTech';

/** Create a RFC-4122 UUID v4 identifier. */
export function createId(): string {
  return crypto.randomUUID();
}

/** Alias for distributed tracing identifiers. */
export function createTraceId(): string {
  return createId();
}

export function createRequestId(): string {
  return createId();
}

export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Giá trị bắt buộc bị thiếu',
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizePage(page?: number): number {
  if (page === undefined || Number.isNaN(page) || page < 1) {
    return 1;
  }
  return Math.floor(page);
}

export function normalizePageSize(
  pageSize?: number,
  options: { defaultSize?: number; maxSize?: number } = {},
): number {
  const defaultSize = options.defaultSize ?? 20;
  const maxSize = options.maxSize ?? 100;
  if (pageSize === undefined || Number.isNaN(pageSize) || pageSize < 1) {
    return defaultSize;
  }
  return Math.min(Math.floor(pageSize), maxSize);
}
