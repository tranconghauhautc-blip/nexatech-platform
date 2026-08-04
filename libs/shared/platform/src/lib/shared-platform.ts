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

/**
 * Các dấu hiệu lỗi kết nối database tạm thời (container DB chưa sẵn sàng,
 * đang "starting up", hoặc bị từ chối kết nối). Chỉ những lỗi khớp mẫu này
 * mới nên được coi là "retryable" khi kết nối Prisma lúc khởi động service.
 */
const RETRYABLE_DB_CONNECTION_PATTERNS: readonly RegExp[] = [
  /starting up/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /P1001/,
  /P1002/,
  /Can't reach database server/i,
];

/** Kiểm tra một lỗi có phải lỗi kết nối database tạm thời, nên retry hay không. */
export function isRetryableDbConnectionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${'code' in error ? String((error as { code?: unknown }).code) : ''}`
      : String(error);
  return RETRYABLE_DB_CONNECTION_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

export interface ConnectWithRetryOptions {
  /** Số lần thử tối đa (bao gồm lần đầu). Mặc định 10. */
  maxAttempts?: number;
  /** Backoff cơ bản (ms), nhân theo số lần thử. Mặc định 500ms. */
  baseDelayMs?: number;
  /** Giới hạn trên của backoff (ms). Mặc định 3000ms. */
  maxDelayMs?: number;
  /** Callback gọi trước mỗi lần retry (ví dụ để log). */
  onRetry?: (attempt: number, maxAttempts: number, error: unknown) => void;
  /** Cho phép ghi đè hàm sleep (hữu ích cho unit test). */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gọi `connect` với retry có giới hạn (bounded) khi database chưa sẵn sàng
 * lúc container mới khởi động (race condition thường gặp trước khi
 * `depends_on` healthcheck kịp ổn định, hoặc khi chạy ngoài Compose).
 *
 * Chỉ retry với lỗi khớp `isRetryableDbConnectionError`; lỗi khác được throw
 * ngay. Sau khi hết `maxAttempts`, lỗi cuối cùng được throw ra ngoài.
 */
export async function connectWithRetry(
  connect: () => Promise<void>,
  options: ConnectWithRetryOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 10;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connect();
      return;
    } catch (error) {
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt || !isRetryableDbConnectionError(error)) {
        throw error;
      }
      options.onRetry?.(attempt, maxAttempts, error);
      const delay = Math.min(baseDelayMs * attempt, maxDelayMs);
      await sleep(delay);
    }
  }
}

/**
 * Đọc biến môi trường bắt buộc ngoài NODE_ENV=test.
 * Dùng để fail-fast thay vì silent fallback sang InMemory client.
 */
export function requireEnvOutsideTest(
  name: string,
  options: { allowTestFallback?: boolean } = {},
): string | undefined {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  if (process.env['NODE_ENV'] === 'test' || options.allowTestFallback) {
    return undefined;
  }
  throw new Error(
    `${name} bắt buộc khi chạy ngoài NODE_ENV=test (không được silent fallback InMemory)`,
  );
}
