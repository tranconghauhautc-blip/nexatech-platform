import { redirect } from 'next/navigation';
import { canAccessAdminPortal } from '@nexatech/shared-auth';
import { getAdminSession } from '../lib/server-session';

export default async function RootPage() {
  const session = await getAdminSession();
  if (session && canAccessAdminPortal(session.roles)) {
    redirect('/bang-dieu-khien');
  }
  redirect('/dang-nhap');
}
