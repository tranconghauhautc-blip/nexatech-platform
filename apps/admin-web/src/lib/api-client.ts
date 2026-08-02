'use client';

import {
  ApiError,
  ApiErrorCodes,
  isApiErrorEnvelope,
} from '@nexatech/shared-web';
import type { AdminServiceKey } from './service-urls';

export type QueryValue = string | number | boolean | undefined | null;

export interface BffRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

/** Gọi BFF nội bộ (`/api/bff/{service}/...`) từ client component. Cookie phiên tự động gửi kèm. */
export async function bffRequest<T = unknown>(
  service: AdminServiceKey,
  path: string,
  options: BffRequestOptions = {},
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `/api/bff/${service}/${normalizedPath}${buildQueryString(options.query)}`;
  const hasBody = options.body !== undefined && options.body !== null;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (hasBody) {
    headers['content-type'] = 'application/json';
  }
  if (options.idempotencyKey) {
    headers['idempotency-key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    throw new ApiError(
      {
        errorCode: ApiErrorCodes.NETWORK_ERROR,
        message: 'Không thể kết nối máy chủ',
        details: {
          cause: error instanceof Error ? error.message : String(error),
        },
        traceId: 'client',
        timestamp: new Date().toISOString(),
      },
      0,
    );
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    if (isApiErrorEnvelope(parsed)) {
      throw new ApiError(parsed, response.status);
    }
    throw new ApiError(
      {
        errorCode: ApiErrorCodes.INTERNAL_ERROR,
        message: `Yêu cầu thất bại (HTTP ${response.status})`,
        traceId: 'client',
        timestamp: new Date().toISOString(),
      },
      response.status,
    );
  }

  return parsed as T;
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Đã xảy ra lỗi không xác định',
): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
