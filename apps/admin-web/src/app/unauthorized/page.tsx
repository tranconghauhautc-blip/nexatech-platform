'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UnauthorizedBody() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const redirect = redirectParam
    ? `?redirect=${encodeURIComponent(redirectParam)}`
    : '';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background:
          'radial-gradient(circle at top left, #e8f1ff, #f7f8fb 45%, #eef2f7)',
        fontFamily: 'Be Vietnam Pro, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.08em', color: '#5b6b7c' }}>401</p>
        <h1 style={{ fontSize: '1.75rem', margin: '0.5rem 0' }}>
          Chưa xác thực
        </h1>
        <p style={{ color: '#4a5a6a', lineHeight: 1.5 }}>
          Bạn cần đăng nhập để truy cập khu vực quản trị NexaTech. Session
          cookie httpOnly sẽ được tạo sau khi đăng nhập thành công.
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <Link href={`/dang-nhap${redirect}`}>Đăng nhập admin</Link>
        </p>
      </div>
    </main>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={null}>
      <UnauthorizedBody />
    </Suspense>
  );
}
