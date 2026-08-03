import { ApiError, isApiErrorEnvelope } from '@nexatech/shared-web';

export interface BffFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
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

function safeClientMessage(data: unknown, fallback: string): string {
  if (typeof data !== 'string' || !data.trim()) {
    return fallback;
  }
  if (looksLikeHtml(data)) {
    return fallback;
  }
  const normalized = data.replace(/\s+/g, ' ').trim();
  return normalized.length > 280 ? `${normalized.slice(0, 279)}…` : normalized;
}

function buildPath(path: string, query?: BffFetchOptions['query']): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Fetch tiện ích phía trình duyệt cho các route `/api/bff/...` và `/api/auth/...`. */
export async function bffFetch<T = unknown>(
  path: string,
  options: BffFetchOptions = {},
): Promise<T> {
  const { query, headers, ...rest } = options;
  const response = await fetch(buildPath(path, query), {
    credentials: 'same-origin',
    ...rest,
    headers: {
      ...(rest.body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  let data: unknown;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    if (isApiErrorEnvelope(data)) {
      throw new ApiError(data, response.status);
    }
    throw new ApiError(
      {
        errorCode: 'INTERNAL_ERROR',
        message: safeClientMessage(data, 'Đã xảy ra lỗi, vui lòng thử lại'),
        traceId: 'client',
        timestamp: new Date().toISOString(),
      },
      response.status,
    );
  }

  return data as T;
}

export const bff = {
  get: <T = unknown>(path: string, query?: BffFetchOptions['query']) =>
    bffFetch<T>(path, { method: 'GET', query }),
  post: <T = unknown>(path: string, body?: unknown) =>
    bffFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T = unknown>(path: string, body?: unknown) =>
    bffFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    bffFetch<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T = unknown>(path: string) =>
    bffFetch<T>(path, { method: 'DELETE' }),
};

export function getErrorMessage(
  error: unknown,
  fallback = 'Đã xảy ra lỗi, vui lòng thử lại',
): string {
  if (error instanceof ApiError) {
    if (looksLikeHtml(error.message)) {
      return fallback;
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    if (looksLikeHtml(error.message)) {
      return fallback;
    }
    return error.message || fallback;
  }
  return fallback;
}
