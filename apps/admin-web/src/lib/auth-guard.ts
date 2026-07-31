import {
  canAccessAdminPortal,
  hasMinimumRole,
  type Role,
} from '@nexatech/shared-auth';
import { ADMIN_MENU_ITEMS } from './menu';
import type { AdminSessionPayload } from './session';

/** Public paths (no session required). */
export const PUBLIC_ADMIN_PATHS = ['/dang-nhap', '/unauthorized', '/forbidden'];

export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Lab console always available (always-on vulnerable PoC). */
export function isSecurityLabUiEnabled(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

/** Minimum role required for a path based on admin menu catalog. */
export function minimumRoleForPath(pathname: string): Role | null {
  const exact = ADMIN_MENU_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact.minimumRole;
  const prefix = ADMIN_MENU_ITEMS.find(
    (item) =>
      pathname.startsWith(`${item.href}/`) && item.href !== '/bang-dieu-khien',
  );
  return prefix?.minimumRole ?? null;
}

export type GuardDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: string };

/**
 * Pure admin access decision for middleware.
 * - Unauthenticated → /unauthorized (or login with redirect for deep links)
 * - Authenticated without portal role → /forbidden
 * - Authenticated below menu minimumRole → /forbidden
 * - /security-lab always available (ADR-044 always-on)
 */
export function decideAdminAccess(
  session: AdminSessionPayload | null,
  pathname: string,
  _env: NodeJS.ProcessEnv = process.env,
): GuardDecision {
  const isPublic = isPublicAdminPath(pathname);

  if (isPublic) {
    if (
      pathname.startsWith('/dang-nhap') &&
      session &&
      canAccessAdminPortal(session.roles)
    ) {
      return { action: 'redirect', destination: '/bang-dieu-khien' };
    }
    return { action: 'allow' };
  }

  if (!session) {
    if (pathname === '/' || pathname === '/bang-dieu-khien') {
      return {
        action: 'redirect',
        destination: `/dang-nhap?redirect=${encodeURIComponent(pathname)}`,
      };
    }
    return {
      action: 'redirect',
      destination: `/unauthorized?redirect=${encodeURIComponent(pathname)}`,
    };
  }

  if (!canAccessAdminPortal(session.roles)) {
    return { action: 'redirect', destination: '/forbidden?ly_do=portal' };
  }

  const required = minimumRoleForPath(pathname);
  if (required && !hasMinimumRole(session.roles, required)) {
    return {
      action: 'redirect',
      destination: `/forbidden?ly_do=rbac&can=${required}`,
    };
  }

  return { action: 'allow' };
}
