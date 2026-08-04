import type { Metadata } from 'next';
import { AccountShell } from './account-shell';

export const metadata: Metadata = {
  title: 'Tài khoản',
  description: 'Quản lý hồ sơ, đơn hàng, bảo hành và hỗ trợ NexaTech.',
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountShell>{children}</AccountShell>;
}
