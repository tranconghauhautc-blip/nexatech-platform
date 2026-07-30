import Link from 'next/link';
import { ACCOUNT_NAV } from '../../lib/constants';

export default function AccountHomePage() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Tổng quan tài khoản</h2>
      <p style={{ color: '#4b6478' }}>
        Quản lý hồ sơ, đơn hàng, đánh giá, bảo hành và hỗ trợ tại một nơi.
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {ACCOUNT_NAV.filter((item) => item.href !== '/tai-khoan').map(
          (item) => (
            <li key={item.href}>
              <Link href={item.href} className="nt-btn nt-btn-ghost">
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
