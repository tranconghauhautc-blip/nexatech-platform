import { redirect } from 'next/navigation';
import { canAccessAdminPortal } from '@nexatech/shared-auth';
import { getAdminSession } from '../../lib/server-session';
import { AdminShell } from '../../components/layout/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session || !canAccessAdminPortal(session.roles)) {
    redirect('/dang-nhap');
  }

  return (
    <AdminShell email={session.email} roles={session.roles}>
      {children}
    </AdminShell>
  );
}
