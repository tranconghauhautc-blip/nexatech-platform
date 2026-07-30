import { canAccessAdminPortal } from '@nexatech/shared-auth';
import type { AdminSessionPayload } from './session';

/** Các đường dẫn không yêu cầu phiên đăng nhập (public trong admin-web). */
export const PUBLIC_ADMIN_PATHS = ['/dang-nhap'];

export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export type GuardDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: string };

/**
 * Quyết định cho phép truy cập hay chuyển hướng, dựa trên phiên hiện tại và
 * đường dẫn được yêu cầu. Hàm thuần (không phụ thuộc runtime) để dễ unit test;
 * middleware chỉ gọi hàm này sau khi đã đọc + xác thực cookie phiên.
 */
export function decideAdminAccess(
  session: AdminSessionPayload | null,
  pathname: string,
): GuardDecision {
  const isPublic = isPublicAdminPath(pathname);

  if (isPublic) {
    if (session && canAccessAdminPortal(session.roles)) {
      return { action: 'redirect', destination: '/bang-dieu-khien' };
    }
    return { action: 'allow' };
  }

  if (!session) {
    const redirectTo = `/dang-nhap?redirect=${encodeURIComponent(pathname)}`;
    return { action: 'redirect', destination: redirectTo };
  }

  if (!canAccessAdminPortal(session.roles)) {
    return { action: 'redirect', destination: '/dang-nhap?loi=khong_du_quyen' };
  }

  return { action: 'allow' };
}
