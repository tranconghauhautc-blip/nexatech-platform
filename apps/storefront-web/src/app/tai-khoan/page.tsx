import Link from 'next/link';
import { loadAccountOverview } from '../../lib/account-server';
import styles from './page.module.css';

function displayCount(value: number | null, error: boolean): string {
  if (error || value === null) {
    return '—';
  }
  return String(value);
}

export default async function AccountHomePage() {
  const data = await loadAccountOverview();

  return (
    <div className={styles.root}>
      <h2 style={{ marginTop: 0 }}>Tổng quan tài khoản</h2>
      <p className={styles.lead}>
        Theo dõi đơn hàng, yêu thích, thông báo và các hoạt động tài khoản của
        bạn.
      </p>

      <div className={styles.grid}>
        <Link
          href="/tai-khoan/ho-so"
          className={`${styles.card} ${styles.wide}`}
        >
          <span className={styles.label}>Hồ sơ</span>
          <span className={styles.value}>
            {data.profile.error
              ? '—'
              : data.profile.fullName?.trim() || 'Chưa cập nhật'}
          </span>
          <span className={styles.sub}>
            {data.profile.error
              ? 'Không tải được hồ sơ'
              : data.profile.phone?.trim()
                ? `SĐT: ${data.profile.phone}`
                : 'Chưa có số điện thoại'}
          </span>
          <span className={styles.linkHint}>Quản lý hồ sơ →</span>
        </Link>

        <Link
          href="/tai-khoan/ho-so"
          className={`${styles.card} ${styles.wide}`}
        >
          <span className={styles.label}>Địa chỉ mặc định</span>
          <span className={styles.value} style={{ fontSize: '1rem' }}>
            {data.defaultAddress.error
              ? '—'
              : data.defaultAddress.summary?.trim() || 'Chưa có địa chỉ'}
          </span>
          <span className={styles.sub}>
            {data.defaultAddress.error
              ? 'Không tải được địa chỉ'
              : data.defaultAddress.summary
                ? 'Địa chỉ giao hàng chính'
                : 'Thêm địa chỉ để thanh toán nhanh hơn'}
          </span>
          <span className={styles.linkHint}>Quản lý địa chỉ →</span>
        </Link>

        <Link href="/tai-khoan/don-hang" className={styles.card}>
          <span className={styles.label}>Đơn hàng</span>
          <span className={styles.value}>
            {displayCount(data.orders.total, data.orders.error)}
          </span>
          <span className={styles.sub}>
            {data.orders.error
              ? 'Không tải được đơn hàng'
              : data.orders.needingAction !== null &&
                  data.orders.needingAction > 0
                ? `${data.orders.needingAction} cần theo dõi`
                : 'Tất cả đơn đã xử lý'}
          </span>
          <span className={styles.linkHint}>Xem đơn hàng →</span>
        </Link>

        <Link href="/tai-khoan/thanh-toan" className={styles.card}>
          <span className={styles.label}>Thanh toán</span>
          <span className={styles.value}>
            {displayCount(data.payments.total, data.payments.error)}
          </span>
          <span className={styles.sub}>
            {data.payments.error
              ? 'Không tải được giao dịch'
              : data.payments.pending !== null && data.payments.pending > 0
                ? `${data.payments.pending} chờ xử lý`
                : 'Không có giao dịch chờ'}
          </span>
          <span className={styles.linkHint}>Lịch sử thanh toán →</span>
        </Link>

        <Link href="/tai-khoan/yeu-thich" className={styles.card}>
          <span className={styles.label}>Yêu thích</span>
          <span className={styles.value}>
            {displayCount(data.wishlist.count, data.wishlist.error)}
          </span>
          <span className={styles.sub}>Sản phẩm đã lưu</span>
          <span className={styles.linkHint}>Danh sách yêu thích →</span>
        </Link>

        <Link href="/tai-khoan/so-sanh" className={styles.card}>
          <span className={styles.label}>So sánh</span>
          <span className={styles.value}>
            {displayCount(data.compare.count, data.compare.error)}
          </span>
          <span className={styles.sub}>Sản phẩm trong bảng so sánh</span>
          <span className={styles.linkHint}>So sánh sản phẩm →</span>
        </Link>

        <Link href="/tai-khoan/da-xem" className={styles.card}>
          <span className={styles.label}>Đã xem gần đây</span>
          <span className={styles.value}>
            {displayCount(data.recentlyViewed.count, data.recentlyViewed.error)}
          </span>
          <span className={styles.sub}>Sản phẩm vừa xem</span>
          <span className={styles.linkHint}>Xem lại →</span>
        </Link>

        <Link href="/tai-khoan/thong-bao" className={styles.card}>
          <span className={styles.label}>Thông báo</span>
          <span className={styles.value}>
            {displayCount(data.notifications.unread, data.notifications.error)}
          </span>
          <span className={styles.sub}>Chưa đọc</span>
          <span className={styles.linkHint}>Hộp thư thông báo →</span>
        </Link>

        <Link href="/tai-khoan/ho-tro" className={styles.card}>
          <span className={styles.label}>Hỗ trợ</span>
          <span className={styles.value}>
            {displayCount(data.support.open, data.support.error)}
          </span>
          <span className={styles.sub}>Phiếu đang mở</span>
          <span className={styles.linkHint}>Trung tâm hỗ trợ →</span>
        </Link>

        <Link href="/tai-khoan/bao-hanh" className={styles.card}>
          <span className={styles.label}>Bảo hành & đổi trả</span>
          <span className={styles.value}>
            {displayCount(
              data.warrantyReturns.active,
              data.warrantyReturns.error,
            )}
          </span>
          <span className={styles.sub}>Yêu cầu đang xử lý</span>
          <span className={styles.linkHint}>Theo dõi yêu cầu →</span>
        </Link>
      </div>
    </div>
  );
}
