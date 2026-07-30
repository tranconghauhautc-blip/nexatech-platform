import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
  type AdminSessionPayload,
} from './session';

/** Đọc + xác thực phiên admin hiện tại từ cookie httpOnly (Server Component / Route Handler). */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
