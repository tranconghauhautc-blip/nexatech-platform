'use client';

import { useCallback, useMemo, useState } from 'react';
import type { QueryValue } from './api-client';

export interface UseListControlsOptions {
  defaultSort?: string;
  /** Map committed search text into query filter keys */
  searchToFilters?: (search: string) => Record<string, QueryValue>;
}

export function useListControls(options: UseListControlsOptions = {}) {
  const { defaultSort = '', searchToFilters } = options;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState(defaultSort);

  const apply = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const reset = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setSort(defaultSort);
    setPage(1);
  }, [defaultSort]);

  const filters = useMemo(() => {
    const next: Record<string, QueryValue> = {};
    if (search && searchToFilters) {
      Object.assign(next, searchToFilters(search));
    } else if (search) {
      next['q'] = search;
    }
    if (status) next['status'] = status;
    if (sort) next['sort'] = sort;
    return next;
  }, [search, searchToFilters, status, sort]);

  return {
    page,
    setPage,
    searchInput,
    setSearchInput,
    search,
    status,
    setStatus,
    sort,
    setSort,
    filters,
    apply,
    reset,
  };
}
