'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ReturnContent() {
  const search = useSearchParams();
  const responseCode =
    search.get('vnp_ResponseCode') || search.get('code') || '';
  const ok = responseCode === '00' || search.get('status') === 'success';

  return (
    <div className="nt-container" style={{ padding: '3rem 0', maxWidth: 640 }}>
      <h1 style={{ color: ok ? '#15803d' : '#b91c1c' }}>
        {ok
          ? 'Thanh toán VNPay thành công'
          : 'Thanh toán VNPay chưa thành công'}
      </h1>
      <p style={{ color: '#4b6478' }}>
        Kết quả được xác nhận phía payment-service. Bạn có thể theo dõi đơn
        trong tài khoản.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <Link href="/tai-khoan/don-hang" className="nt-btn nt-btn-primary">
          Đơn hàng của tôi
        </Link>
        <Link href="/" className="nt-btn nt-btn-ghost">
          Trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function VnpayReturnPage() {
  return (
    <Suspense fallback={<div className="nt-container">Đang tải…</div>}>
      <ReturnContent />
    </Suspense>
  );
}
