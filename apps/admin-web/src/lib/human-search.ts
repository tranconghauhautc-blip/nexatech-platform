'use client';

import { useCallback, useMemo, useState } from 'react';
import { bffRequest } from './api-client';
import type { QueryValue } from './api-client';
import { isUuid } from './display-helpers';
import { useListControls } from './use-list-controls';

export interface OrderSearchResolution {
  orderId?: string;
  clientQ?: string;
}

export async function resolveOrderIdByCode(
  orderCode: string,
): Promise<string | undefined> {
  const term = orderCode.trim();
  if (!term) return undefined;
  try {
    const response = await bffRequest<{
      items?: Array<{ id?: string }>;
    }>('order', 'admin/orders', {
      query: { orderCode: term, page: 1, pageSize: 1 },
    });
    return response.items?.[0]?.id;
  } catch {
    return undefined;
  }
}

export async function resolveOrderSearch(
  term: string,
): Promise<OrderSearchResolution> {
  const trimmed = term.trim();
  if (!trimmed) return {};
  if (isUuid(trimmed)) return { orderId: trimmed };
  const orderId = await resolveOrderIdByCode(trimmed);
  if (orderId) return { orderId };
  return { clientQ: trimmed };
}

export interface UseHumanListControlsOptions {
  defaultSort?: string;
  /** Extra API filters merged on apply (e.g. productId for UUID). */
  resolveApiFilters?: (
    term: string,
  ) => Promise<Record<string, QueryValue>> | Record<string, QueryValue>;
}

/**
 * Mở rộng useListControls: tách tìm kiếm API (orderId, UUID…) và lọc client (mã đơn, email…).
 */
export function useHumanListControls(
  options: UseHumanListControlsOptions = {},
) {
  const { defaultSort = '', resolveApiFilters } = options;
  const controls = useListControls({
    defaultSort,
    searchToFilters: () => ({}),
  });
  const [apiSearchFilters, setApiSearchFilters] = useState<
    Record<string, QueryValue>
  >({});
  const [clientSearch, setClientSearch] = useState('');
  const [resolving, setResolving] = useState(false);

  const filters = useMemo(
    () => ({
      ...controls.filters,
      ...apiSearchFilters,
    }),
    [controls.filters, apiSearchFilters],
  );

  const applySearch = useCallback(async () => {
    const term = controls.searchInput.trim();
    setResolving(true);
    try {
      if (!term) {
        setApiSearchFilters({});
        setClientSearch('');
      } else if (resolveApiFilters) {
        const resolved = await resolveApiFilters(term);
        const { _clientQ, ...apiOnly } = resolved as Record<
          string,
          QueryValue
        > & {
          _clientQ?: string;
        };
        setApiSearchFilters(apiOnly);
        setClientSearch(
          typeof _clientQ === 'string'
            ? _clientQ
            : Object.keys(apiOnly).length === 0
              ? term
              : '',
        );
      } else {
        setApiSearchFilters({});
        setClientSearch(term);
      }
      controls.setPage(1);
    } finally {
      setResolving(false);
    }
  }, [controls, resolveApiFilters]);

  const resetAll = useCallback(() => {
    controls.reset();
    setApiSearchFilters({});
    setClientSearch('');
  }, [controls]);

  return {
    ...controls,
    filters,
    clientSearch,
    resolving,
    applySearch,
    resetAll,
  };
}

export async function resolveOrderApiFilters(
  term: string,
): Promise<Record<string, QueryValue>> {
  const resolved = await resolveOrderSearch(term);
  if (resolved.orderId) return { orderId: resolved.orderId };
  return { _clientQ: resolved.clientQ ?? term };
}

export function resolveUuidOrClient(
  term: string,
  param: string,
): Record<string, QueryValue> {
  if (isUuid(term)) return { [param]: term };
  return { _clientQ: term };
}
