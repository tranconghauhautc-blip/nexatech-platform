'use client';

import { useEffect, useState } from 'react';
import { type Role, isRole } from '@nexatech/shared-auth';

/**
 * Client-side admin roles from session endpoint (for UI gating only).
 * Backend still enforces RBAC on every mutation.
 */
export function useAdminRoles(): Role[] {
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { roles?: unknown };
        const parsed = Array.isArray(body.roles)
          ? body.roles.filter(
              (r): r is Role => typeof r === 'string' && isRole(r),
            )
          : [];
        if (!cancelled) setRoles(parsed);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return roles;
}
