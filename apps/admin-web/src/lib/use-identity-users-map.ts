'use client';

import { useEffect, useMemo, useState } from 'react';
import { bffRequest, getErrorMessage } from './api-client';

export interface IdentityUserBrief {
  id: string;
  email: string;
  fullName: string;
}

/** Batch-load identity admin users once để map actorId → email/fullName. */
export function useIdentityUsersMap() {
  const [users, setUsers] = useState<IdentityUserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bffRequest<{ items?: IdentityUserBrief[] }>('identity', 'admin/users', {
      query: { page: 1, pageSize: 500 },
    })
      .then((response) => {
        if (!cancelled) {
          setUsers(Array.isArray(response.items) ? response.items : []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
          setUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usersById = useMemo(() => {
    const map = new Map<string, IdentityUserBrief>();
    for (const user of users) {
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  function formatActor(actorId: unknown): string {
    const id = String(actorId ?? '');
    if (!id) return '—';
    const user = usersById.get(id);
    if (user) {
      return user.fullName?.trim()
        ? `${user.fullName} (${user.email})`
        : user.email;
    }
    return id;
  }

  function actorMatchesSearch(actorId: unknown, term: string): boolean {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    const id = String(actorId ?? '').toLowerCase();
    if (id.includes(q)) return true;
    const user = usersById.get(String(actorId ?? ''));
    if (!user) return false;
    return (
      user.email.toLowerCase().includes(q) ||
      user.fullName.toLowerCase().includes(q)
    );
  }

  return { usersById, loading, error, formatActor, actorMatchesSearch };
}
