'use client';

import { useCallback, useEffect, useState } from 'react';
import { bffRequest, getErrorMessage, type QueryValue } from './api-client';
import type { AdminServiceKey } from './service-urls';

export interface UseArrayQueryOptions {
  service: AdminServiceKey;
  path: string;
  query?: Record<string, QueryValue>;
  enabled?: boolean;
}

export interface UseArrayQueryResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Hook cho các endpoint trả về mảng trực tiếp (không phân trang), ví dụ danh mục/thương hiệu/kho. */
export function useArrayQuery<T>({
  service,
  path,
  query,
  enabled = true,
}: UseArrayQueryOptions): UseArrayQueryResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const queryKey = JSON.stringify(query ?? {});

  const load = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return () => undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    bffRequest<T[]>(service, path, { query })
      .then((response) => {
        if (!cancelled) setItems(Array.isArray(response) ? response : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, path, queryKey, enabled, reloadToken]);

  useEffect(() => load(), [load]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { items, loading, error, refetch };
}
