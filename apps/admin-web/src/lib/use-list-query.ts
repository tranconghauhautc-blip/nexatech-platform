'use client';

import { useCallback, useEffect, useState } from 'react';
import { bffRequest, getErrorMessage, type QueryValue } from './api-client';
import type { AdminServiceKey } from './service-urls';

export interface BackendPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface BackendPaginatedResponse<T> {
  items: T[];
  meta: BackendPaginationMeta;
}

export interface UseListQueryOptions {
  service: AdminServiceKey;
  path: string;
  page: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, QueryValue>;
}

export interface UseListQueryResult<T> {
  items: T[];
  meta: BackendPaginationMeta;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY_META: BackendPaginationMeta = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
};

/** Hook dùng chung cho các trang danh sách admin: gọi BFF, chuẩn hóa loading/error/empty. */
export function useListQuery<T>({
  service,
  path,
  page,
  pageSize = 20,
  sortBy,
  sortDir,
  filters,
}: UseListQueryOptions): UseListQueryResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<BackendPaginationMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const filterKey = JSON.stringify(filters ?? {});

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query: Record<string, QueryValue> = {
      page,
      pageSize,
      ...(sortBy ? { sortBy, sortDir: sortDir ?? 'desc' } : {}),
      ...(filters ?? {}),
    };

    bffRequest<BackendPaginatedResponse<T>>(service, path, { query })
      .then((response) => {
        if (cancelled) return;
        setItems(response.items ?? []);
        setMeta(response.meta ?? { ...EMPTY_META, page, pageSize });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, path, page, pageSize, sortBy, sortDir, filterKey, reloadToken]);

  useEffect(() => load(), [load]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { items, meta, loading, error, refetch };
}
