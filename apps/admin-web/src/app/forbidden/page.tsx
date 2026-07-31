'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ForbiddenBody() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('ly_do');
  const needed = searchParams.get('can');
  let detail =
    'Tài khoản đã đăng nhập nhưng không đủ quyền cho trang này (RBAC).';
  if (reason === 'lab_off') {
    detail =
      'Trang Security Lab chỉ khả dụng khi deploy profile security-lab (không có trên production artifact).';
  } else if (reason === 'portal') {
    detail = 'Tài khoản không thuộc nhóm Staff/Manager/Admin/SuperAdmin.';
  } else if (needed) {
    detail = `Cần tối thiểu vai trò ${needed} theo menu/policy hiện tại.`;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background:
          'radial-gradient(circle at top right, #ffe8e8, #f7f8fb 45%, #eef2f7)',
        fontFamily: 'Be Vietnam Pro, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.08em', color: '#8a5b5b' }}>403</p>
        <h1 style={{ fontSize: '1.75rem', margin: '0.5rem 0' }}>
          Không đủ quyền
        </h1>
        <p style={{ color: '#4a5a6a', lineHeight: 1.5 }}>{detail}</p>
        <p
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          <Link href="/bang-dieu-khien">Về bảng điều khiển</Link>
          <Link href="/dang-nhap">Đăng nhập lại</Link>
        </p>
      </div>
    </main>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenBody />
    </Suspense>
  );
}
