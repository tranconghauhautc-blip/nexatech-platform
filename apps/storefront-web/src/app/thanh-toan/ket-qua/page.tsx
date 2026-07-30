'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './page.module.css';

function ResultContent() {
  const search = useSearchParams();
  const status = search.get('status') ?? 'success';
  const orderId = search.get('orderId');
  const code = search.get('code');
  const ok = status === 'success';

  return (
    <div className={`nt-container ${styles.root}`}>
      <h1 className={ok ? styles.ok : styles.fail}>
        {ok ? 'Đặt hàng thành công' : 'Thanh toán / đặt hàng chưa hoàn tất'}
      </h1>
      <p className={styles.lead}>
        {ok
          ? 'Cảm ơn bạn đã mua sắm tại NexaTech. Đơn hàng đang được xử lý.'
          : 'Vui lòng kiểm tra lại đơn hàng hoặc thử phương thức thanh toán khác.'}
      </p>
      {code ? (
        <p>
          Mã đơn: <strong>{code}</strong>
        </p>
      ) : null}
      {orderId ? (
        <p>
          Mã tham chiếu: <code>{orderId}</code>
        </p>
      ) : null}
      <div className={styles.actions}>
        {orderId ? (
          <Link
            href={`/tai-khoan/don-hang/${orderId}`}
            className="nt-btn nt-btn-primary"
          >
            Xem chi tiết đơn
          </Link>
        ) : null}
        <Link href="/" className="nt-btn nt-btn-ghost">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div className="nt-container">Đang tải…</div>}>
      <ResultContent />
    </Suspense>
  );
}
