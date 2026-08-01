import {
  ApiError,
  ApiErrorCodes,
  isApiErrorEnvelope,
  type ApiErrorEnvelope,
} from './api-error';

export type QueryValue = string | number | boolean | undefined | null;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `nt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trimStart().slice(0, 64).toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<head') ||
    trimmed.includes('<script')
  );
}

function truncateMessage(value: string, max = 280): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getHeaders?: ApiClientOptions['getHeaders'];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.getHeaders = options.getHeaders;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const requestId = createId();
    const traceId = createId();
    const method =
      options.method ?? (options.body !== undefined ? 'POST' : 'GET');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-request-id': requestId,
      'x-trace-id': traceId,
      ...(await this.getHeaders?.()),
      ...options.headers,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
      }
    }

    try {
      const response = await fetch(
        buildUrl(this.baseUrl, path, options.query),
        {
          method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: controller.signal,
        },
      );
      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = text;
        }
      }
      if (!response.ok) {
        if (isApiErrorEnvelope(data)) {
          throw new ApiError(data, response.status);
        }
        const envelope: ApiErrorEnvelope = {
          errorCode: 'HTTP_ERROR',
          message:
            typeof data === 'string' && data.length > 0 && !looksLikeHtml(data)
              ? truncateMessage(data)
              : response.statusText || 'Yêu cầu thất bại',
          traceId,
          timestamp: new Date().toISOString(),
        };
        throw new ApiError(envelope, response.status);
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(
          {
            errorCode: ApiErrorCodes.TIMEOUT,
            message: 'Hết thời gian chờ phản hồi từ máy chủ',
            traceId,
            timestamp: new Date().toISOString(),
          },
          408,
        );
      }
      throw new ApiError(
        {
          errorCode: ApiErrorCodes.NETWORK_ERROR,
          message: error instanceof Error ? error.message : 'Lỗi mạng',
          traceId,
          timestamp: new Date().toISOString(),
        },
        500,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export function mapApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return looksLikeHtml(error.message)
      ? 'Đã xảy ra lỗi, vui lòng thử lại'
      : truncateMessage(error.message);
  }
  if (error instanceof Error) {
    return looksLikeHtml(error.message)
      ? 'Đã xảy ra lỗi, vui lòng thử lại'
      : truncateMessage(error.message);
  }
  return 'Đã xảy ra lỗi không xác định';
}
